import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  computeTransactionNetAmount,
  findHoldingShortfall,
  summarizeMarketTransactions,
} from '@/lib/investments';
import {
  listTransactions,
  loadTransactionInvestment,
  parseTransactionInput,
  requestMeta,
  transactionErrorResponse,
} from '@/lib/investment-transactions';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadTransactionInvestment(params.id, me.id);
  if (investment.error) return investment.error;

  try {
    const parsed = parseTransactionInput(await req.json(), investment);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.values;

    const existingTransactions = await listTransactions(params.id, me.id);
    const current = existingTransactions.find((tx) => tx.id === params.txId);
    if (!current) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });

    const nextTransactions = existingTransactions.map((tx) => (tx.id === params.txId ? { ...tx, ...v } : tx));
    if (!findHoldingShortfall(existingTransactions) && findHoldingShortfall(nextTransactions)) {
      return NextResponse.json({ error: 'This change would leave a sale larger than the units held on that date.' }, { status: 400 });
    }

    const { ip, userAgent } = requestMeta(req);
    const [record] = await sql`
      WITH before AS (
        SELECT * FROM investment_transactions
        WHERE id = ${params.txId} AND investment_id = ${params.id} AND user_id = ${me.id}
      ), updated AS (
        UPDATE investment_transactions t
        SET transaction_type = ${v.transaction_type},
            trade_date = ${v.trade_date},
            units = ${v.units},
            price_per_unit = ${v.price_per_unit},
            total_amount = ${v.total_amount},
            charges = ${v.charges},
            taxes = ${v.taxes},
            notes = ${v.notes},
            updated_at = now()
        FROM before
        WHERE t.id = before.id
        RETURNING t.*
      ), audit AS (
        INSERT INTO investment_transaction_audit (investment_id, user_id, transaction_id, action, before_data, after_data, ip_address, user_agent)
        SELECT u.investment_id, u.user_id, u.id, 'update', to_jsonb(b), to_jsonb(u), ${ip}::text, ${userAgent}::text
        FROM updated u JOIN before b ON b.id = u.id
      )
      SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, updated_at
      FROM updated
    `;
    if (!record) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });

    const nextSummary = summarizeMarketTransactions(existingTransactions.map((tx) => (tx.id === record.id ? record : tx)));
    return NextResponse.json({ record: { ...record, net_amount: computeTransactionNetAmount(record) }, summary: nextSummary });
  } catch (err) {
    return transactionErrorResponse(err, 'Could not update transaction.');
  }
}

export async function DELETE(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadTransactionInvestment(params.id, me.id);
  if (investment.error) return investment.error;

  try {
    const existingTransactions = await listTransactions(params.id, me.id);
    if (!existingTransactions.some((tx) => tx.id === params.txId)) {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }

    const remaining = existingTransactions.filter((tx) => tx.id !== params.txId);
    if (!findHoldingShortfall(existingTransactions) && findHoldingShortfall(remaining)) {
      return NextResponse.json({ error: 'A later sale depends on these units. Delete or edit that sale first.' }, { status: 400 });
    }

    const { ip, userAgent } = requestMeta(req);
    const deleted = await sql`
      WITH deleted AS (
        DELETE FROM investment_transactions
        WHERE id = ${params.txId} AND investment_id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      ), audit AS (
        INSERT INTO investment_transaction_audit (investment_id, user_id, transaction_id, action, before_data, ip_address, user_agent)
        SELECT investment_id, user_id, id, 'delete', to_jsonb(deleted), ${ip}::text, ${userAgent}::text FROM deleted
      )
      SELECT id FROM deleted
    `;
    if (deleted.length === 0) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });

    return NextResponse.json({ ok: true, summary: summarizeMarketTransactions(remaining) });
  } catch (err) {
    return transactionErrorResponse(err, 'Could not delete transaction.');
  }
}
