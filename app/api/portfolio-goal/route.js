import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function missingTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('user_settings') && msg.includes('does not exist');
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const rows = await sql`SELECT overall_goal_amount, overall_goal_date FROM user_settings WHERE user_id = ${me.id}`;
    if (rows.length === 0) return NextResponse.json({ goal: null });
    return NextResponse.json({
      goal: {
        amount: rows[0].overall_goal_amount ? Number(rows[0].overall_goal_amount) : null,
        date: rows[0].overall_goal_date || null,
      },
    });
  } catch (err) {
    if (missingTable(err)) return NextResponse.json({ goal: null });
    throw err;
  }
}

export async function PUT(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { amount, date } = await req.json();
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Goal amount must be greater than zero.' }, { status: 400 });
    }

    await sql`
      INSERT INTO user_settings (user_id, overall_goal_amount, overall_goal_date, updated_at)
      VALUES (${me.id}, ${Number(amount)}, ${date || null}, now())
      ON CONFLICT (user_id) DO UPDATE
        SET overall_goal_amount = EXCLUDED.overall_goal_amount,
            overall_goal_date   = EXCLUDED.overall_goal_date,
            updated_at          = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (missingTable(err)) {
      return NextResponse.json(
        { error: 'Database schema is out of date. Run db/migrations/2026-06-24-add-portfolio-goal.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('portfolio-goal PUT error', err);
    return NextResponse.json({ error: 'Could not save goal.' }, { status: 500 });
  }
}

export async function DELETE() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    await sql`DELETE FROM user_settings WHERE user_id = ${me.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (missingTable(err)) return NextResponse.json({ ok: true });
    throw err;
  }
}
