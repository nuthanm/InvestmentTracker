import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { computeMaturity, addMonths } from '@/lib/format';

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rows = await sql`
    SELECT i.*, g.name AS goal_name
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.id = ${params.id} AND i.user_id = ${me.id}
    LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const documents = await sql`
    SELECT id, filename, size_bytes, page_count, data_url
    FROM documents WHERE investment_id = ${params.id}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({ investment: rows[0], documents });
}

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const currentRows = await sql`
      SELECT id, start_date
      FROM investments
      WHERE id = ${params.id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (currentRows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });

    const body = await req.json();
    const required = ['type_code', 'bank', 'plan_name', 'amount', 'rate_pct', 'tenure_months', 'nominee', 'goal_id'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `${field.replace(/_/g, ' ')} is required.` }, { status: 400 });
      }
    }
    if (body.type_code === 'OT' && !body.custom_type) {
      return NextResponse.json({ error: 'Please name your custom investment type.' }, { status: 400 });
    }
    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }
    if (Number(body.rate_pct) <= 0) {
      return NextResponse.json({ error: 'Interest rate must be greater than zero.' }, { status: 400 });
    }
    if (Number(body.tenure_months) <= 0 && Number(body.tenure_days || 0) <= 0) {
      return NextResponse.json({ error: 'Pick a valid tenure.' }, { status: 400 });
    }

    const startDate = body.start_date ? new Date(body.start_date) : new Date(currentRows[0].start_date);
    const tenureMonths = Number(body.tenure_months) + (Number(body.tenure_days || 0) / 30);
    const maturityValue = computeMaturity({
      amount: Number(body.amount),
      ratePct: Number(body.rate_pct),
      months: tenureMonths,
      compounding: body.compounding || 'quarterly',
    });
    const maturityDate = addMonths(startDate, tenureMonths);

    const rows = await sql`
      UPDATE investments
      SET
        goal_id = ${body.goal_id},
        type_code = ${body.type_code},
        custom_type = ${body.custom_type || null},
        bank = ${body.bank},
        plan_name = ${body.plan_name},
        amount = ${body.amount},
        rate_pct = ${body.rate_pct},
        tenure_months = ${body.tenure_months},
        tenure_days = ${body.tenure_days || 0},
        compounding = ${body.compounding || 'quarterly'},
        start_date = ${startDate.toISOString().slice(0, 10)},
        maturity_date = ${maturityDate.toISOString().slice(0, 10)},
        maturity_value = ${maturityValue},
        nominee = ${body.nominee},
        auto_renew = ${!!body.auto_renew}
      WHERE id = ${params.id} AND user_id = ${me.id}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Investment not found.' }, { status: 404 });

    if (Array.isArray(body.documents)) {
      const existingDocs = await sql`
        SELECT id
        FROM documents
        WHERE investment_id = ${params.id}
      `;
      const nextDocIds = new Set(body.documents.filter((doc) => doc.id).map((doc) => String(doc.id)));

      for (const doc of existingDocs) {
        if (!nextDocIds.has(String(doc.id))) {
          await sql`DELETE FROM documents WHERE id = ${doc.id} AND investment_id = ${params.id}`;
        }
      }

      for (const doc of body.documents) {
        if (doc.id || !doc.filename || !doc.data_url) continue;
        await sql`
          INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
          VALUES (${params.id}, ${doc.filename}, ${doc.size_bytes || 0}, ${doc.page_count || 1}, ${doc.data_url})
        `;
      }
    }

    return NextResponse.json({ investment: rows[0] });
  } catch (err) {
    console.error('update investment error', err);
    return NextResponse.json({ error: 'Could not update investment.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    await sql`DELETE FROM investments WHERE id = ${params.id} AND user_id = ${me.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  }
}
