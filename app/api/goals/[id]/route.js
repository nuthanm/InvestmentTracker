import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { name, description, target_amount, target_date, inflation_pct, icon } = await req.json();
    if (!name || !target_amount) return NextResponse.json({ error: 'Name and target amount are required.' }, { status: 400 });
    if (!target_date) return NextResponse.json({ error: 'Target date is required.' }, { status: 400 });
    if (Number(target_amount) <= 0) return NextResponse.json({ error: 'Target amount must be greater than zero.' }, { status: 400 });
    const infl = Number(inflation_pct || 0);
    if (Number.isNaN(infl) || infl < 0) return NextResponse.json({ error: 'Inflation percentage must be zero or more.' }, { status: 400 });

    let rows;
    try {
      rows = await sql`
        UPDATE goals
        SET name = ${name.trim()}, description = ${description?.trim() || null}, target_amount = ${target_amount}, target_date = ${target_date}, inflation_pct = ${infl}, icon = ${icon || 'house'}
        WHERE id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      `;
    } catch (err) {
      const isMissingInflationColumn = err?.code === '42703' || /inflation_pct/i.test(String(err?.message || ''));
      if (!isMissingInflationColumn) throw err;
      rows = await sql`
        UPDATE goals
        SET name = ${name.trim()}, description = ${description?.trim() || null}, target_amount = ${target_amount}, target_date = ${target_date}, icon = ${icon || 'house'}
        WHERE id = ${params.id} AND user_id = ${me.id}
        RETURNING *
      `;
    }

    if (!rows.length) return NextResponse.json({ error: 'Goal not found.' }, { status: 404 });
    return NextResponse.json({ goal: rows[0] });
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
