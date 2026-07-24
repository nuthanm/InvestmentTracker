import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { computeMaturity, computeRecurringMaturity, addMonths } from '@/lib/format';
import {
  attachInvestmentSummaries,
  attachRecurringPaymentSummaries,
  computeTransactionGross,
  computeTransactionNetAmount,
  isMarketInvestment,
  isMetalInvestment,
  isTransactionBased,
} from '@/lib/investments';
import { isChitInvestment } from '@/lib/chit';
import { missingChitDetailsColumn, resolveChitWrite, seedPaymentRecords } from '@/lib/chit-api';

function missingTransactionsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('investment_transactions') && msg.includes('does not exist');
}

function missingPaymentRecordsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('payment_records') && msg.includes('does not exist');
}

function parseDateInput(value) {
  const dt = value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function validateInitialTransaction(tx) {
  if (!tx) return null;
  const transactionType = String(tx.transaction_type || 'buy').toLowerCase();
  const tradeDate = parseDateInput(tx.trade_date);
  if (!tradeDate) return { error: 'Initial transaction date is invalid.' };

  const units = Number(tx.units || 0);
  const pricePerUnit = Number(tx.price_per_unit || 0);
  const charges = Number(tx.charges || 0);
  const taxes = Number(tx.taxes || 0);
  const totalAmount = Number(tx.total_amount || units * pricePerUnit || 0);

  if (transactionType !== 'buy') {
    return { error: 'The initial transaction must be a buy.' };
  }
  if (units <= 0) {
    return { error: 'Initial buy units must be greater than zero.' };
  }
  if (pricePerUnit <= 0) {
    return { error: 'Initial buy price must be greater than zero.' };
  }
  if (totalAmount <= 0) {
    return { error: 'Initial buy amount must be greater than zero.' };
  }
  if (charges < 0 || taxes < 0) {
    return { error: 'Charges and taxes cannot be negative.' };
  }

  return {
    transaction_type: transactionType,
    trade_date: tradeDate.toISOString().slice(0, 10),
    units,
    price_per_unit: pricePerUnit,
    total_amount: totalAmount,
    charges,
    taxes,
    notes: tx.notes?.trim() || null,
  };
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investments = await sql`
    SELECT i.*, g.name AS goal_name,
      (SELECT COUNT(*) FROM documents WHERE investment_id = i.id) AS document_count
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.user_id = ${me.id}
    ORDER BY i.created_at DESC
  `;

  const transactionIds = investments.filter((investment) => isTransactionBased(investment.type_code)).map((investment) => investment.id);
  const recurringIds = investments
    .filter((investment) => investment.payment_frequency === 'monthly' || investment.payment_frequency === 'yearly')
    .map((investment) => investment.id);

  let withSummaries = investments;

  if (transactionIds.length > 0) {
    try {
      const transactions = await sql`
        SELECT investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, id
        FROM investment_transactions
        WHERE user_id = ${me.id} AND investment_id = ANY(${transactionIds})
        ORDER BY trade_date ASC, created_at ASC
      `;
      withSummaries = attachInvestmentSummaries(withSummaries, transactions);
    } catch (err) {
      if (!missingTransactionsTable(err)) throw err;
    }
  }

  if (recurringIds.length > 0) {
    try {
      const paymentRecords = await sql`
        SELECT investment_id, period_label, due_date, amount, paid, paid_at, notes
        FROM payment_records
        WHERE user_id = ${me.id} AND investment_id = ANY(${recurringIds})
        ORDER BY due_date ASC
      `;
      withSummaries = attachRecurringPaymentSummaries(withSummaries, paymentRecords);
    } catch (err) {
      if (!missingPaymentRecordsTable(err)) throw err;
    }
  }

  return NextResponse.json({ investments: withSummaries });
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const body = await req.json();
    const marketInvestment = isMarketInvestment(body.type_code);
    const metalInvestment = isMetalInvestment(body.type_code);
    const chitInvestment = isChitInvestment(body.type_code);
    const transactionBasedInvestment = marketInvestment || metalInvestment;
    const required = transactionBasedInvestment
      ? ['type_code', 'bank', 'plan_name', 'nominee', 'goal_id']
      : chitInvestment
        ? ['type_code', 'bank', 'plan_name', 'tenure_months', 'nominee', 'goal_id']
        : ['type_code', 'bank', 'plan_name', 'amount', 'rate_pct', 'tenure_months', 'nominee', 'goal_id'];

    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `${field.replace(/_/g, ' ')} is required.` }, { status: 400 });
      }
    }
    if (body.type_code === 'OT' && !body.custom_type) {
      return NextResponse.json({ error: 'Please name your custom investment type.' }, { status: 400 });
    }

    const goalRows = await sql`
      SELECT id
      FROM goals
      WHERE id = ${body.goal_id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (goalRows.length === 0) {
      return NextResponse.json({ error: 'Please select a valid goal.' }, { status: 400 });
    }

    if (transactionBasedInvestment) {
      const initialTransaction = validateInitialTransaction(body.initial_transaction);
      if (initialTransaction?.error) {
        return NextResponse.json({ error: initialTransaction.error }, { status: 400 });
      }

      const startDate = parseDateInput(initialTransaction?.trade_date || body.start_date);
      if (!startDate) {
        return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 });
      }

      const startingAmount = initialTransaction ? computeTransactionNetAmount(initialTransaction) : 0;
      const rows = await sql`
        INSERT INTO investments (
          user_id, goal_id, type_code, custom_type, bank, plan_name,
          amount, rate_pct, tenure_months, tenure_days, compounding,
          payment_frequency, start_date, maturity_date, maturity_value, nominee, auto_renew, account_holder
        )
        VALUES (
          ${me.id}, ${body.goal_id}, ${body.type_code}, ${body.custom_type || null},
          ${body.bank.trim()}, ${body.plan_name.trim()},
          ${startingAmount}, 0, 0, 0, 'quarterly',
          'lump_sum', ${startDate.toISOString().slice(0, 10)}, NULL, NULL,
          ${body.nominee.trim()}, false, ${body.account_holder || 'Self'}
        )
        RETURNING *
      `;
      const investment = rows[0];

      if (initialTransaction) {
        try {
          await sql`
            INSERT INTO investment_transactions (
              investment_id, user_id, transaction_type, trade_date, units, price_per_unit,
              total_amount, charges, taxes, notes
            )
            VALUES (
              ${investment.id}, ${me.id}, ${initialTransaction.transaction_type}, ${initialTransaction.trade_date}, ${initialTransaction.units},
              ${initialTransaction.price_per_unit}, ${computeTransactionGross(initialTransaction)}, ${initialTransaction.charges},
              ${initialTransaction.taxes}, ${initialTransaction.notes}
            )
          `;
        } catch (err) {
          if (missingTransactionsTable(err)) {
            return NextResponse.json(
              { error: 'Market transactions are not available yet. Run db/migrations/2026-06-22-add-market-investment-transactions.sql in Neon SQL Editor.' },
              { status: 409 }
            );
          }
          throw err;
        }
      }

      if (Array.isArray(body.documents)) {
        for (const doc of body.documents) {
          if (!doc.filename || !doc.data_url) continue;
          await sql`
            INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
            VALUES (${investment.id}, ${doc.filename}, ${doc.size_bytes || 0}, ${doc.page_count || 1}, ${doc.data_url})
          `;
        }
      }

      return NextResponse.json({ investment });
    }

    if (chitInvestment) {
      const chitWrite = resolveChitWrite(body);
      if (chitWrite?.error) {
        return NextResponse.json({ error: chitWrite.error }, { status: 400 });
      }

      const startDate = parseDateInput(body.start_date);
      if (!startDate) {
        return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 });
      }
      const maturityDate = addMonths(startDate, chitWrite.tenure_months);

      let investment;
      try {
        const rows = await sql`
          INSERT INTO investments (
            user_id, goal_id, type_code, custom_type, bank, plan_name,
            amount, rate_pct, tenure_months, tenure_days, compounding,
            payment_frequency, start_date, maturity_date, maturity_value, nominee, auto_renew, account_holder,
            chit_details
          )
          VALUES (
            ${me.id}, ${body.goal_id}, 'CHIT', NULL,
            ${body.bank.trim()}, ${body.plan_name.trim()},
            ${chitWrite.amount}, ${chitWrite.rate_pct}, ${chitWrite.tenure_months}, 0, ${chitWrite.compounding},
            ${chitWrite.payment_frequency},
            ${startDate.toISOString().slice(0, 10)}, ${maturityDate.toISOString().slice(0, 10)}, ${chitWrite.maturity_value},
            ${body.nominee.trim()}, false, ${body.account_holder || 'Self'},
            ${JSON.stringify(chitWrite.chit_details)}::jsonb
          )
          RETURNING *
        `;
        investment = rows[0];
      } catch (err) {
        if (missingChitDetailsColumn(err)) {
          return NextResponse.json(
            { error: 'Database schema is out of date. Run db/migrations/2026-07-24-add-chit-details.sql in Neon SQL Editor, then try again.' },
            { status: 409 }
          );
        }
        throw err;
      }

      try {
        await seedPaymentRecords(sql, { investment, userId: me.id });
      } catch (err) {
        if (!missingPaymentRecordsTable(err)) throw err;
      }

      if (Array.isArray(body.documents)) {
        for (const doc of body.documents) {
          if (!doc.filename || !doc.data_url) continue;
          await sql`
            INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
            VALUES (${investment.id}, ${doc.filename}, ${doc.size_bytes || 0}, ${doc.page_count || 1}, ${doc.data_url})
          `;
        }
      }

      return NextResponse.json({ investment });
    }

    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }
    if (Number(body.rate_pct) <= 0) {
      return NextResponse.json({ error: 'Interest rate must be greater than zero.' }, { status: 400 });
    }

    const paymentFrequency = body.payment_frequency || 'lump_sum';
    const tenureMonths = Number(body.tenure_months) + (Number(body.tenure_days || 0) / 30);

    let maturityValue;
    if (paymentFrequency === 'monthly' || paymentFrequency === 'yearly') {
      maturityValue = computeRecurringMaturity({
        amountPerPeriod: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        paymentFrequency,
      });
    } else {
      maturityValue = computeMaturity({
        amount: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        compounding: body.compounding || 'quarterly',
      });
    }

    const startDate = parseDateInput(body.start_date);
    if (!startDate) {
      return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 });
    }
    const maturityDate = addMonths(startDate, tenureMonths);

    const rows = await sql`
      INSERT INTO investments (
        user_id, goal_id, type_code, custom_type, bank, plan_name,
        amount, rate_pct, tenure_months, tenure_days, compounding,
        payment_frequency, start_date, maturity_date, maturity_value, nominee, auto_renew, account_holder
      )
      VALUES (
        ${me.id}, ${body.goal_id}, ${body.type_code}, ${body.custom_type || null},
        ${body.bank.trim()}, ${body.plan_name.trim()},
        ${body.amount}, ${body.rate_pct}, ${body.tenure_months}, ${body.tenure_days || 0}, ${body.compounding || 'quarterly'},
        ${paymentFrequency},
        ${startDate.toISOString().slice(0, 10)}, ${maturityDate.toISOString().slice(0, 10)}, ${maturityValue},
        ${body.nominee.trim()}, ${!!body.auto_renew}, ${body.account_holder || 'Self'}
      )
      RETURNING *
    `;
    const investment = rows[0];

    if (Array.isArray(body.documents)) {
      for (const doc of body.documents) {
        if (!doc.filename || !doc.data_url) continue;
        await sql`
          INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
          VALUES (${investment.id}, ${doc.filename}, ${doc.size_bytes || 0}, ${doc.page_count || 1}, ${doc.data_url})
        `;
      }
    }

    return NextResponse.json({ investment });
  } catch (err) {
    console.error('create investment error', err);
    if (err?.code === '22P02') {
      return NextResponse.json({ error: 'Invalid ID format in request.' }, { status: 400 });
    }
    if (err?.code === '23503') {
      return NextResponse.json({ error: 'Selected goal does not exist.' }, { status: 400 });
    }
    if (err?.code === '42703') {
      return NextResponse.json(
        {
          error:
            'Database schema is out of date. Run the SQL files in db/migrations (including 2026-06-22-add-market-investment-transactions.sql) in Neon SQL Editor, then try again.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Could not create investment.' }, { status: 500 });
  }
}
