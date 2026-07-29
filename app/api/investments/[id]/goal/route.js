import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { goal_id } = await req.json();

  if (goal_id) {
    const goalRows = await sql`
      SELECT id FROM goals WHERE id = ${goal_id} AND user_id = ${me.id} LIMIT 1
    `;
    if (goalRows.length === 0) {
      return NextResponse.json({ error: 'Goal not found.' }, { status: 400 });
    }
  }

  const rows = await sql`
    UPDATE investments
    SET goal_id = ${goal_id || null}
    WHERE id = ${params.id} AND user_id = ${me.id}
    RETURNING id, goal_id
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });
  }

  return NextResponse.json({ investment: rows[0] });
}
