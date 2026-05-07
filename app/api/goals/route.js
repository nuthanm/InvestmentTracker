import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const goals = await sql`
    SELECT g.*,
      COALESCE((SELECT SUM(amount) FROM investments WHERE goal_id = g.id), 0) AS current_amount,
      (SELECT COUNT(*) FROM investments WHERE goal_id = g.id) AS investment_count
    FROM goals g
    WHERE user_id = ${me.id}
    ORDER BY g.created_at DESC
  `;
  return NextResponse.json({ goals });
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
