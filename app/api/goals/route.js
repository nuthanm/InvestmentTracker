import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { attachInvestmentSummaries, effectiveInvestedSoFar, isMarketInvestment } from '@/lib/investments';

function missingTransactionsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('investment_transactions') && msg.includes('does not exist');
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const [goals, rawInvestments] = await Promise.all([
    sql`SELECT * FROM goals WHERE user_id = ${me.id} ORDER BY created_at DESC`,
    sql`SELECT id, goal_id, type_code, amount, payment_frequency, tenure_months, maturity_value, start_date FROM investments WHERE user_id = ${me.id}`,
  ]);

  let investments = rawInvestments;
  const marketIds = rawInvestments.filter((investment) => isMarketInvestment(investment.type_code)).map((investment) => investment.id);
  if (marketIds.length > 0) {
    try {
      const transactions = await sql`
        SELECT investment_id, transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, notes, created_at, id
        FROM investment_transactions
        WHERE user_id = ${me.id} AND investment_id = ANY(${marketIds})
      `;
      investments = attachInvestmentSummaries(rawInvestments, transactions);
    } catch (err) {
      if (!missingTransactionsTable(err)) throw err;
    }
  }

  const totals = new Map();
  const counts = new Map();
  for (const investment of investments) {
    if (!investment.goal_id) continue;
    totals.set(investment.goal_id, (totals.get(investment.goal_id) || 0) + effectiveInvestedSoFar(investment));
    counts.set(investment.goal_id, (counts.get(investment.goal_id) || 0) + 1);
  }

  const hydratedGoals = goals.map((goal) => ({
    ...goal,
    current_amount: totals.get(goal.id) || 0,
    investment_count: counts.get(goal.id) || 0,
  }));

  return NextResponse.json({ goals: hydratedGoals });
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { name, target_amount, target_date, icon } = await req.json();
    if (!name || !target_amount) {
      return NextResponse.json({ error: 'Name and target amount are required.' }, { status: 400 });
    }
    if (Number(target_amount) <= 0) {
      return NextResponse.json({ error: 'Target amount must be greater than zero.' }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO goals (user_id, name, target_amount, target_date, icon)
      VALUES (${me.id}, ${name.trim()}, ${target_amount}, ${target_date || null}, ${icon || 'house'})
      RETURNING *
    `;
    return NextResponse.json({ goal: rows[0] });
  } catch (err) {
    console.error('create goal error', err);
    return NextResponse.json({ error: 'Could not create goal.' }, { status: 500 });
  }
}
