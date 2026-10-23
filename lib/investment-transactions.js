import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { computeTransactionGross, isMarketInvestment, isMetalInvestment } from '@/lib/investments';

const MARKET_ALLOWED_TYPES = new Set(['buy', 'redeem', 'dividend', 'bonus', 'split', 'switch_in', 'switch_out']);
const METAL_ALLOWED_TYPES = new Set(['buy', 'sell']);
const MARKET_SELL_TYPES = new Set(['redeem', 'switch_out']);
const MARKET_BUY_TYPES = new Set(['buy', 'switch_in']);
const UNIT_ONLY_TYPES = new Set(['bonus', 'split']);

const TRANSACTIONS_MIGRATION = 'db/migrations/2026-06-22-add-market-investment-transactions.sql';
const AUDIT_MIGRATION = 'db/migrations/2026-10-24-add-transaction-audit.sql';

export function transactionErrorResponse(err, fallbackMessage) {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('investment_transaction_audit') || (msg.includes('updated_at') && msg.includes('does not exist'))) {
    return NextResponse.json(
      { error: `Transaction auditing is not set up yet. Run ${AUDIT_MIGRATION} in Neon SQL Editor.` },
      { status: 409 }
    );
  }
  if (msg.includes('investment_transactions') && msg.includes('does not exist')) {
    return NextResponse.json(
      { error: `Market transactions are not available yet. Run ${TRANSACTIONS_MIGRATION} in Neon SQL Editor.` },
      { status: 409 }
    );
  }
  console.error(fallbackMessage, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function loadTransactionInvestment(investmentId, userId) {
  const rows = await sql`
    SELECT id, type_code
    FROM investments
    WHERE id = ${investmentId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) };

  const typeCode = rows[0].type_code;
  const marketInvestment = isMarketInvestment(typeCode);
  const metalInvestment = isMetalInvestment(typeCode);
  if (!marketInvestment && !metalInvestment) {
    return { error: NextResponse.json({ error: 'Transactions are only available for market and metal investments.' }, { status: 409 }) };
  }
  return { marketInvestment, metalInvestment };
}

export async function listTransactions(investmentId, userId) {
  return sql`
    SELECT id, investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, updated_at
    FROM investment_transactions
    WHERE investment_id = ${investmentId} AND user_id = ${userId}
    ORDER BY trade_date DESC, created_at DESC
  `;
}

function parseTradeDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

// Returns { error } or { values } with the normalized columns to store.
export function parseTransactionInput(body, { marketInvestment }) {
  const transactionType = String(body?.transaction_type || '').toLowerCase();
  const allowedTypes = marketInvestment ? MARKET_ALLOWED_TYPES : METAL_ALLOWED_TYPES;
  if (!allowedTypes.has(transactionType)) return { error: 'Pick a valid transaction type.' };

  const tradeDate = parseTradeDate(body.trade_date);
  if (!tradeDate) return { error: 'Trade date is invalid.' };

  const units = Number(body.units || 0);
  const pricePerUnit = Number(body.price_per_unit || 0);
  const charges = Number(body.charges || 0);
  const taxes = Number(body.taxes || 0);
  const totalAmount = Number(body.total_amount || units * pricePerUnit || 0);
  const notes = body.notes?.trim() || null;

  if (![units, pricePerUnit, charges, taxes, totalAmount].every(Number.isFinite)) {
    return { error: 'Enter valid numbers.' };
  }
  if (units < 0 || pricePerUnit < 0 || totalAmount < 0) return { error: 'Values cannot be negative.' };
  if (charges < 0 || taxes < 0) return { error: 'Charges and taxes cannot be negative.' };

  const isBuyType = marketInvestment ? MARKET_BUY_TYPES.has(transactionType) : transactionType === 'buy';
  const isSellType = marketInvestment ? MARKET_SELL_TYPES.has(transactionType) : transactionType === 'sell';

  if (isBuyType || isSellType) {
    if (units <= 0) return { error: 'Units must be greater than zero.' };
    if (pricePerUnit <= 0) return { error: 'Price per unit must be greater than zero.' };
    if (totalAmount <= 0) return { error: 'Transaction amount must be greater than zero.' };
  }
  if (marketInvestment && transactionType === 'dividend' && totalAmount <= 0) {
    return { error: 'Dividend amount must be greater than zero.' };
  }
  if (marketInvestment && UNIT_ONLY_TYPES.has(transactionType) && units <= 0) {
    return { error: 'Units must be greater than zero.' };
  }

  return {
    values: {
      transaction_type: transactionType,
      trade_date: tradeDate,
      units,
      price_per_unit: pricePerUnit,
      total_amount: computeTransactionGross({ total_amount: totalAmount, units, price_per_unit: pricePerUnit }),
      charges,
      taxes,
      notes,
    },
  };
}

export function requestMeta(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  return {
    ip: forwarded ? forwarded.split(',')[0]?.trim() || null : null,
    userAgent: req.headers.get('user-agent') || null,
  };
}
