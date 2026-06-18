import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/investments/[id]/payments — list all payment records for this investment
export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Verify ownership
  const inv = await sql`
    SELECT id FROM investments WHERE id = ${params.id} AND user_id = ${me.id} LIMIT 1
  `;
  if (inv.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const records = await sql`
    SELECT id, period_label, due_date, amount, paid, paid_at, notes
    FROM payment_records
    WHERE investment_id = ${params.id}
    ORDER BY due_date ASC
  `;
  return NextResponse.json({ records });
}

// POST /api/investments/[id]/payments — upsert a payment record (toggle paid/unpaid)
// Body: { period_label, due_date, amount, paid }
export async function POST(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Verify ownership
  const inv = await sql`
    SELECT id FROM investments WHERE id = ${params.id} AND user_id = ${me.id} LIMIT 1
  `;
  if (inv.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  try {
    const body = await req.json();
    const { period_label, due_date, amount, paid, notes } = body;
    if (!period_label || !due_date || amount === undefined) {
      return NextResponse.json({ error: 'period_label, due_date, and amount are required.' }, { status: 400 });
    }

    const paidBool = !!paid;
    const paidAt = paidBool ? new Date().toISOString() : null;

    const rows = await sql`
      INSERT INTO payment_records (investment_id, user_id, period_label, due_date, amount, paid, paid_at, notes)
      VALUES (
        ${params.id}, ${me.id}, ${period_label}, ${due_date},
        ${Number(amount)}, ${paidBool}, ${paidAt}, ${notes || null}
      )
      ON CONFLICT (investment_id, period_label)
      DO UPDATE SET
        paid = EXCLUDED.paid,
        paid_at = CASE WHEN EXCLUDED.paid THEN COALESCE(payment_records.paid_at, EXCLUDED.paid_at) ELSE NULL END,
        notes = COALESCE(EXCLUDED.notes, payment_records.notes)
      RETURNING *
    `;
    return NextResponse.json({ record: rows[0] });
  } catch (err) {
    console.error('payment record error', err);
    return NextResponse.json({ error: 'Could not save payment record.' }, { status: 500 });
  }
}
