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

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadTransactionInvestment(params.id, me.id);
  if (investment.error) return investment.error;

  try {
    const transactions = await listTransactions(params.id, me.id);
    return NextResponse.json({ transactions, summary: summarizeMarketTransactions(transactions) });
  } catch (err) {
    return transactionErrorResponse(err, 'Could not load transactions.');
  }
}

export async function POST(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadTransactionInvestment(params.id, me.id);
  if (investment.error) return investment.error;

  try {
    const parsed = parseTransactionInput(await req.json(), investment);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.values;

    const existingTransactions = await listTransactions(params.id, me.id);
    const candidate = { ...v, id: 'new', created_at: new Date().toISOString() };
    if (!findHoldingShortfall(existingTransactions) && findHoldingShortfall([...existingTransactions, candidate])) {
      return NextResponse.json({ error: 'Redeemed units cannot exceed your holding on that date.' }, { status: 400 });
    }

    const { ip, userAgent } = requestMeta(req);
    const [record] = await sql`
      WITH inserted AS (
        INSERT INTO investment_transactions (
          investment_id, user_id, transaction_type, trade_date, units, price_per_unit,
          total_amount, charges, taxes, notes
        )
        VALUES (
          ${params.id}, ${me.id}, ${v.transaction_type}, ${v.trade_date}, ${v.units}, ${v.price_per_unit},
          ${v.total_amount}, ${v.charges}, ${v.taxes}, ${v.notes}
        )
        RETURNING *
      ), audit AS (
        INSERT INTO investment_transaction_audit (investment_id, user_id, transaction_id, action, after_data, ip_address, user_agent)
        SELECT investment_id, user_id, id, 'create', to_jsonb(inserted), ${ip}::text, ${userAgent}::text FROM inserted
      )
      SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, updated_at
      FROM inserted
    `;

    const nextSummary = summarizeMarketTransactions([...existingTransactions, record]);
    return NextResponse.json({ record: { ...record, net_amount: computeTransactionNetAmount(record) }, summary: nextSummary });
  } catch (err) {
    return transactionErrorResponse(err, 'Could not save transaction.');
  }
}
