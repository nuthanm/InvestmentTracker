import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  computeTransactionGross,
  computeTransactionNetAmount,
  isMarketInvestment,
  isMetalInvestment,
  summarizeMarketTransactions,
} from '@/lib/investments';

const MARKET_ALLOWED_TYPES = new Set(['buy', 'redeem', 'dividend', 'bonus', 'split', 'switch_in', 'switch_out']);
const METAL_ALLOWED_TYPES = new Set(['buy', 'sell']);
const SELL_TYPES = new Set(['redeem', 'switch_out']);
const BUY_TYPES = new Set(['buy', 'switch_in']);
const UNIT_ONLY_TYPES = new Set(['bonus', 'split']);

function missingTransactionsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('investment_transactions') && msg.includes('does not exist');
}

function parseTradeDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rows = await sql`
    SELECT id, type_code
    FROM investments
    WHERE id = ${params.id} AND user_id = ${me.id}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const typeCode = rows[0].type_code;
  const marketInvestment = isMarketInvestment(typeCode);
  const metalInvestment = isMetalInvestment(typeCode);
  if (!marketInvestment && !metalInvestment) {
    return NextResponse.json({ error: 'Transactions are only available for market and metal investments.' }, { status: 409 });
  }

  try {
    const transactions = await sql`
      SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at
      FROM investment_transactions
      WHERE investment_id = ${params.id} AND user_id = ${me.id}
      ORDER BY trade_date DESC, created_at DESC
    `;
    return NextResponse.json({ transactions, summary: summarizeMarketTransactions(transactions) });
  } catch (err) {
    if (missingTransactionsTable(err)) {
      return NextResponse.json(
        { error: 'Market transactions are not available yet. Run db/migrations/2026-06-22-add-market-investment-transactions.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('transaction list error', err);
    return NextResponse.json({ error: 'Could not load transactions.' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rows = await sql`
    SELECT id, type_code
    FROM investments
    WHERE id = ${params.id} AND user_id = ${me.id}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const typeCode = rows[0].type_code;
  const marketInvestment = isMarketInvestment(typeCode);
  const metalInvestment = isMetalInvestment(typeCode);
  if (!marketInvestment && !metalInvestment) {
    return NextResponse.json({ error: 'Transactions are only available for market and metal investments.' }, { status: 409 });
  }

  try {
    const body = await req.json();
    const transactionType = String(body.transaction_type || '').toLowerCase();
    const allowedTypes = marketInvestment ? MARKET_ALLOWED_TYPES : METAL_ALLOWED_TYPES;
    if (!allowedTypes.has(transactionType)) {
      return NextResponse.json({ error: 'Pick a valid transaction type.' }, { status: 400 });
    }

    const tradeDate = parseTradeDate(body.trade_date);
    if (!tradeDate) {
      return NextResponse.json({ error: 'Trade date is invalid.' }, { status: 400 });
    }

    const units = Number(body.units || 0);
    const pricePerUnit = Number(body.price_per_unit || 0);
    const charges = Number(body.charges || 0);
    const taxes = Number(body.taxes || 0);
    const totalAmount = Number(body.total_amount || units * pricePerUnit || 0);
    const notes = body.notes?.trim() || null;

    if (charges < 0 || taxes < 0) {
      return NextResponse.json({ error: 'Charges and taxes cannot be negative.' }, { status: 400 });
    }
    const isBuyType = marketInvestment ? BUY_TYPES.has(transactionType) : transactionType === 'buy';
    const isSellType = marketInvestment ? SELL_TYPES.has(transactionType) : transactionType === 'sell';

    if (isBuyType || isSellType) {
      if (units <= 0) return NextResponse.json({ error: 'Units must be greater than zero.' }, { status: 400 });
      if (pricePerUnit <= 0) return NextResponse.json({ error: 'Price per unit must be greater than zero.' }, { status: 400 });
      if (totalAmount <= 0) return NextResponse.json({ error: 'Transaction amount must be greater than zero.' }, { status: 400 });
    }
    if (marketInvestment && transactionType === 'dividend' && totalAmount <= 0) {
      return NextResponse.json({ error: 'Dividend amount must be greater than zero.' }, { status: 400 });
    }
    if (marketInvestment && UNIT_ONLY_TYPES.has(transactionType) && units <= 0) {
      return NextResponse.json({ error: 'Units must be greater than zero.' }, { status: 400 });
    }

    const existingTransactions = await sql`
      SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at
      FROM investment_transactions
      WHERE investment_id = ${params.id} AND user_id = ${me.id}
      ORDER BY trade_date ASC, created_at ASC
    `;
    const summary = summarizeMarketTransactions(existingTransactions);
    const availableUnits = Number(summary.total_units || 0);
    if (isSellType && units - availableUnits > 0.000001) {
      return NextResponse.json({ error: 'Redeemed units cannot exceed your current holding.' }, { status: 400 });
    }

    const [record] = await sql`
      INSERT INTO investment_transactions (
        investment_id, user_id, transaction_type, trade_date, units, price_per_unit,
        total_amount, charges, taxes, notes
      )
      VALUES (
        ${params.id}, ${me.id}, ${transactionType}, ${tradeDate}, ${units}, ${pricePerUnit},
        ${computeTransactionGross({ total_amount: totalAmount, units, price_per_unit: pricePerUnit })}, ${charges}, ${taxes}, ${notes}
      )
      RETURNING id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at
    `;

    const nextSummary = summarizeMarketTransactions([...existingTransactions, record]);
    const netAmount = computeTransactionNetAmount(record);

    return NextResponse.json({ record: { ...record, net_amount: netAmount }, summary: nextSummary });
  } catch (err) {
    if (missingTransactionsTable(err)) {
      return NextResponse.json(
        { error: 'Market transactions are not available yet. Run db/migrations/2026-06-22-add-market-investment-transactions.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('transaction create error', err);
    return NextResponse.json({ error: 'Could not save transaction.' }, { status: 500 });
  }
}
