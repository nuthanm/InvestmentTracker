import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { parseGoalYear } from '@/lib/goals';
import { readOptionalTagNames } from '@/lib/tags';
import { replaceGoalTags } from '@/lib/tag-store';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const body = await req.json();
    const { name, description, target_amount, target_date, inflation_pct, icon, for_liquidity, amount_as_of, goal_year, recurring_yearly } = body;
    const forLiquidity = for_liquidity === true || for_liquidity === 'true';
    if (!name || !target_amount) return NextResponse.json({ error: 'Name and target amount are required.' }, { status: 400 });
    if (!forLiquidity && !target_date) return NextResponse.json({ error: 'Target date is required.' }, { status: 400 });
    if (Number(target_amount) <= 0) return NextResponse.json({ error: 'Target amount must be greater than zero.' }, { status: 400 });
    const infl = Number(inflation_pct || 0);
    if (Number.isNaN(infl) || infl < 0) return NextResponse.json({ error: 'Inflation percentage must be zero or more.' }, { status: 400 });
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
        UPDATE goals
        SET
          name = ${name.trim()},
          description = ${description?.trim() || null},
          target_amount = ${target_amount},
          target_date = ${forLiquidity ? null : target_date},
          inflation_pct = ${infl},
          icon = ${icon || 'house'},
          for_liquidity = ${forLiquidity},
          amount_as_of = ${asOf},
          goal_year = ${goalYear},
          recurring_yearly = ${recurringYearly}
        WHERE id = ${params.id} AND user_id = ${me.id}
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
        UPDATE goals
        SET name = ${name.trim()}, description = ${description?.trim() || null}, target_amount = ${target_amount}, target_date = ${target_date}, icon = ${icon || 'house'}
        WHERE id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      `;
    }

    if (!rows.length) return NextResponse.json({ error: 'Goal not found.' }, { status: 404 });
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
    return NextResponse.json({ goal });
  } catch (err) {
    console.error('update goal error', err);
    return NextResponse.json({ error: 'Could not update goal.' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    await sql`DELETE FROM goals WHERE id = ${params.id} AND user_id = ${me.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('delete goal error', err);
    return NextResponse.json({ error: 'Could not delete goal.' }, { status: 500 });
  }
}
