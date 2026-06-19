import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function missingPaymentRecordsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('payment_records') && msg.includes('does not exist');
}

function missingNotesColumn(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('notes') && msg.includes('does not exist');
}

// GET /api/investments/[id]/payments — list all payment records for this investment
export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Verify ownership
  const inv = await sql`
    SELECT id FROM investments WHERE id = ${params.id} AND user_id = ${me.id} LIMIT 1
  `;
  if (inv.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  try {
    let records;
    try {
      records = await sql`
        SELECT id, period_label, due_date, amount, paid, paid_at, notes
        FROM payment_records
        WHERE investment_id = ${params.id}
        ORDER BY due_date ASC
      `;
    } catch (err) {
      if (!missingNotesColumn(err)) throw err;
      records = await sql`
        SELECT id, period_label, due_date, amount, paid, paid_at, NULL::text AS notes
        FROM payment_records
        WHERE investment_id = ${params.id}
        ORDER BY due_date ASC
      `;
    }
    return NextResponse.json({ records, writable: true });
  } catch (err) {
    if (missingPaymentRecordsTable(err)) {
      return NextResponse.json({
        records: [],
        writable: false,
        warning: 'Payment records are not available yet. Run db/migrations/2026-06-18-add-account-holder-payment-records.sql in Neon SQL Editor.',
      });
    }
    console.error('payment records list error', err);
    return NextResponse.json({ error: 'Could not load payment records.' }, { status: 500 });
  }
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
    const { period_label, due_date, amount, paid, notes, paid_at } = body;
    if (!period_label || !due_date || amount === undefined) {
      return NextResponse.json({ error: 'period_label, due_date, and amount are required.' }, { status: 400 });
    }

    const paidBool = !!paid;
    const paidAtInput = typeof paid_at === 'string' ? paid_at.trim() : '';
    let paidAt = null;
    if (paidBool) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(paidAtInput)) {
        // Pin to noon UTC to avoid accidental date shifts when rendered in local time.
        paidAt = `${paidAtInput}T12:00:00.000Z`;
      } else if (paidAtInput) {
        const parsed = new Date(paidAtInput);
        if (!Number.isNaN(parsed.getTime())) paidAt = parsed.toISOString();
      }
      if (!paidAt) paidAt = new Date().toISOString();
    }

    let rows;
    try {
      rows = await sql`
        INSERT INTO payment_records (investment_id, user_id, period_label, due_date, amount, paid, paid_at, notes)
        VALUES (
          ${params.id}, ${me.id}, ${period_label}, ${due_date},
          ${Number(amount)}, ${paidBool}, ${paidAt}, ${notes || null}
        )
        ON CONFLICT (investment_id, period_label)
        DO UPDATE SET
          paid = EXCLUDED.paid,
          -- Keep the original paid_at timestamp (first time it was marked paid)
          -- rather than overwriting it each time the user toggles the record.
          paid_at = CASE WHEN EXCLUDED.paid THEN COALESCE(payment_records.paid_at, EXCLUDED.paid_at) ELSE NULL END,
          notes = COALESCE(EXCLUDED.notes, payment_records.notes)
        RETURNING *
      `;
    } catch (err) {
      if (!missingNotesColumn(err)) throw err;
      rows = await sql`
        INSERT INTO payment_records (investment_id, user_id, period_label, due_date, amount, paid, paid_at)
        VALUES (
          ${params.id}, ${me.id}, ${period_label}, ${due_date},
          ${Number(amount)}, ${paidBool}, ${paidAt}
        )
        ON CONFLICT (investment_id, period_label)
        DO UPDATE SET
          paid = EXCLUDED.paid,
          -- Keep the original paid_at timestamp (first time it was marked paid)
          -- rather than overwriting it each time the user toggles the record.
          paid_at = CASE WHEN EXCLUDED.paid THEN COALESCE(payment_records.paid_at, EXCLUDED.paid_at) ELSE NULL END
        RETURNING *, NULL::text AS notes
      `;
    }
    return NextResponse.json({ record: rows[0] });
  } catch (err) {
    if (missingPaymentRecordsTable(err)) {
      return NextResponse.json(
        { error: 'Payment records are not available yet. Run db/migrations/2026-06-18-add-account-holder-payment-records.sql in Neon SQL Editor.' },
        { status: 409 }
      );
    }
    console.error('payment record error', err);
    return NextResponse.json({ error: 'Could not save payment record.' }, { status: 500 });
  }
}
