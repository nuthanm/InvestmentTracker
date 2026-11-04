import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { applyMetalSchemeGrams, attachInvestmentSummaries, attachPartialWithdrawals, attachRecurringPaymentSummaries, effectiveInvestedSoFar, isMetalInvestment, isTransactionBased } from '@/lib/investments';
import { isActiveInvestment } from '@/lib/investment-lifecycle';
import { goalTargetAmount, parseGoalYear } from '@/lib/goals';
import { readOptionalTagNames } from '@/lib/tags';
import { attachGoalTags, replaceGoalTags } from '@/lib/tag-store';

function missingTransactionsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('investment_transactions') && msg.includes('does not exist');
}

function missingPaymentRecordsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('payment_records') && msg.includes('does not exist');
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const [goals, rawInvestments] = await Promise.all([
    sql`SELECT * FROM goals WHERE user_id = ${me.id} ORDER BY sort_order ASC NULLS LAST, created_at DESC`,
    sql`SELECT id, goal_id, type_code, amount, payment_frequency, tenure_months, maturity_value, start_date, maturity_date, auto_renew, lifecycle_status, chit_details FROM investments WHERE user_id = ${me.id}`,
  ]);

  let investments = rawInvestments;
  const transactionIds = rawInvestments.filter((investment) => isTransactionBased(investment.type_code)).map((investment) => investment.id);
  if (transactionIds.length > 0) {
    try {
      const transactions = await sql`
        SELECT investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, id
        FROM investment_transactions
        WHERE user_id = ${me.id} AND investment_id = ANY(${transactionIds})
      `;
      investments = attachInvestmentSummaries(rawInvestments, transactions);
    } catch (err) {
      if (!missingTransactionsTable(err)) throw err;
    }
  }

  const recurringIds = investments
    .filter((investment) => investment.payment_frequency === 'monthly' || investment.payment_frequency === 'yearly')
    .map((investment) => investment.id);
  if (recurringIds.length > 0) {
    try {
      let paymentRecords;
      try {
        paymentRecords = await sql`
          SELECT investment_id, period_label, due_date, amount, paid, paid_at, rate_per_gram, grams
          FROM payment_records
          WHERE user_id = ${me.id} AND investment_id = ANY(${recurringIds})
        `;
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (!(msg.includes('rate_per_gram') || msg.includes('grams'))) throw err;
        paymentRecords = await sql`
          SELECT investment_id, period_label, due_date, amount, paid, paid_at
          FROM payment_records
          WHERE user_id = ${me.id} AND investment_id = ANY(${recurringIds})
        `;
      }
      investments = applyMetalSchemeGrams(attachRecurringPaymentSummaries(investments, paymentRecords));
    } catch (err) {
      if (!missingPaymentRecordsTable(err)) throw err;
    }

    try {
      const withdrawals = await sql`
        SELECT id, investment_id, amount, withdrawn_on, notes
        FROM partial_withdrawals
        WHERE user_id = ${me.id} AND investment_id = ANY(${recurringIds})
        ORDER BY withdrawn_on ASC
      `;
      investments = attachPartialWithdrawals(investments, withdrawals);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (!(msg.includes('partial_withdrawals') && msg.includes('does not exist'))) throw err;
    }
  }

  const totals = new Map();
  const counts = new Map();
  for (const investment of investments) {
    if (!investment.goal_id) continue;
    counts.set(investment.goal_id, (counts.get(investment.goal_id) || 0) + 1);
    if (isActiveInvestment(investment) || isMetalInvestment(investment.type_code)) {
      totals.set(investment.goal_id, (totals.get(investment.goal_id) || 0) + effectiveInvestedSoFar(investment));
    }
  }

  const hydratedGoals = await attachGoalTags(goals.map((goal) => ({
    ...goal,
    current_amount: totals.get(goal.id) || 0,
    investment_count: counts.get(goal.id) || 0,
    required_amount: goalTargetAmount(goal),
  })));

  return NextResponse.json({ goals: hydratedGoals });
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, target_amount, target_date, inflation_pct, icon, for_liquidity, amount_as_of, goal_year, recurring_yearly } = body;
    const forLiquidity = for_liquidity === true || for_liquidity === 'true';
    if (!name || !target_amount) {
      return NextResponse.json({ error: 'Name and target amount are required.' }, { status: 400 });
    }
    if (!forLiquidity && !target_date) {
      return NextResponse.json({ error: 'Target date is required.' }, { status: 400 });
    }
    if (Number(target_amount) <= 0) {
      return NextResponse.json({ error: 'Target amount must be greater than zero.' }, { status: 400 });
    }
    const infl = Number(inflation_pct || 0);
    if (Number.isNaN(infl) || infl < 0) {
      return NextResponse.json({ error: 'Inflation percentage must be zero or more.' }, { status: 400 });
    }
    const goalYear = parseGoalYear(goal_year);
    if (goalYear === undefined) {
      return NextResponse.json({ error: 'Choose Life goal or a valid calendar year.' }, { status: 400 });
    }
    const recurringYearly = goalYear != null && (recurring_yearly === true || recurring_yearly === 'true');
    let tagNames;
    try {
      tagNames = readOptionalTagNames(body);
    } catch (err) {
      return NextResponse.json({ error: err.message || 'Invalid tags.' }, { status: err.status || 400 });
    }

    let rows;
    try {
      const asOf = forLiquidity
        ? (String(amount_as_of || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10))
        : null;
      rows = await sql`
        INSERT INTO goals (user_id, name, description, target_amount, target_date, inflation_pct, icon, for_liquidity, amount_as_of, goal_year, recurring_yearly)
        VALUES (
          ${me.id}, ${name.trim()}, ${description?.trim() || null}, ${target_amount},
          ${forLiquidity ? null : target_date}, ${infl}, ${icon || 'house'},
          ${forLiquidity}, ${asOf}, ${goalYear}, ${recurringYearly}
        )
        RETURNING *
      `;
    } catch (err) {
      const msg = String(err?.message || '');
      const isMissingColumn = err?.code === '42703' || /does not exist/i.test(msg);
      if (!isMissingColumn) throw err;
      if (/recurring_yearly/i.test(msg)) {
        return NextResponse.json(
          { error: 'Recurring year goals are not available yet. Run db/migrations/2026-11-04-goal-recurring-yearly.sql in Neon SQL Editor.' },
          { status: 409 }
        );
      }
      if (/goal_year/i.test(msg)) {
        return NextResponse.json(
          { error: 'Year goals are not available yet. Run db/migrations/2026-11-04-goal-year.sql in Neon SQL Editor.' },
          { status: 409 }
        );
      }
      rows = await sql`
        INSERT INTO goals (user_id, name, description, target_amount, target_date, icon)
        VALUES (${me.id}, ${name.trim()}, ${description?.trim() || null}, ${target_amount}, ${target_date}, ${icon || 'house'})
        RETURNING *
      `;
    }

    const goal = rows[0];
    if (tagNames !== undefined) {
      try {
        const tags = await replaceGoalTags(me.id, goal.id, tagNames);
        return NextResponse.json({ goal: { ...goal, tags } });
      } catch (err) {
        if (!/goal_tags/i.test(String(err?.message || ''))) throw err;
        return NextResponse.json(
          { error: 'Goal tags are not available yet. Run db/migrations/2026-11-05-goal-tags.sql in Neon SQL Editor.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ goal: { ...goal, tags: [] } });
  } catch (err) {
    console.error('create goal error', err);
    return NextResponse.json({ error: 'Could not create goal.' }, { status: 500 });
  }
}
