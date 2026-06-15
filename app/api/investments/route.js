import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { computeMaturity, computeRecurringMaturity, addMonths } from '@/lib/format';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investments = await sql`
    SELECT i.*, g.name AS goal_name,
      (SELECT COUNT(*) FROM documents WHERE investment_id = i.id) AS document_count
    FROM investments i
    LEFT JOIN goals g ON g.id = i.goal_id
    WHERE i.user_id = ${me.id}
    ORDER BY i.created_at DESC
  `;
  return NextResponse.json({ investments });
}

export async function POST(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const body = await req.json();
    const required = ['type_code', 'bank', 'plan_name', 'amount', 'rate_pct', 'tenure_months', 'nominee', 'goal_id'];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return NextResponse.json({ error: `${f.replace(/_/g, ' ')} is required.` }, { status: 400 });
      }
    }
    if (body.type_code === 'OT' && !body.custom_type) {
      return NextResponse.json({ error: 'Please name your custom investment type.' }, { status: 400 });
    }
    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const goalRows = await sql`
      SELECT id
      FROM goals
      WHERE id = ${body.goal_id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (goalRows.length === 0) {
      return NextResponse.json({ error: 'Please select a valid goal.' }, { status: 400 });
    }

    const paymentFrequency = body.payment_frequency || 'lump_sum';
    const tenureMonths = Number(body.tenure_months) + (Number(body.tenure_days || 0) / 30);

    let maturityValue;
    if (paymentFrequency === 'monthly' || paymentFrequency === 'yearly') {
      maturityValue = computeRecurringMaturity({
        amountPerPeriod: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        paymentFrequency,
      });
    } else {
      maturityValue = computeMaturity({
        amount: Number(body.amount),
        ratePct: Number(body.rate_pct),
        months: tenureMonths,
        compounding: body.compounding || 'quarterly',
      });
    }

    const startDate = body.start_date ? new Date(body.start_date) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Start date is invalid.' }, { status: 400 });
    }
    const maturityDate = addMonths(startDate, tenureMonths);

    const rows = await sql`
      INSERT INTO investments (
        user_id, goal_id, type_code, custom_type, bank, plan_name,
        amount, rate_pct, tenure_months, tenure_days, compounding,
        payment_frequency, start_date, maturity_date, maturity_value, nominee, auto_renew
      )
      VALUES (
        ${me.id}, ${body.goal_id}, ${body.type_code}, ${body.custom_type || null},
        ${body.bank}, ${body.plan_name},
        ${body.amount}, ${body.rate_pct}, ${body.tenure_months}, ${body.tenure_days || 0}, ${body.compounding || 'quarterly'},
        ${paymentFrequency},
        ${startDate.toISOString().slice(0, 10)}, ${maturityDate.toISOString().slice(0, 10)}, ${maturityValue},
        ${body.nominee}, ${!!body.auto_renew}
      )
      RETURNING *
    `;
    const investment = rows[0];

    if (Array.isArray(body.documents)) {
      for (const doc of body.documents) {
        if (!doc.filename || !doc.data_url) continue;
        await sql`
          INSERT INTO documents (investment_id, filename, size_bytes, page_count, data_url)
          VALUES (${investment.id}, ${doc.filename}, ${doc.size_bytes || 0}, ${doc.page_count || 1}, ${doc.data_url})
        `;
      }
    }

    return NextResponse.json({ investment });
  } catch (err) {
    console.error('create investment error', err);
    if (err?.code === '22P02') {
      return NextResponse.json({ error: 'Invalid ID format in request.' }, { status: 400 });
    }
    if (err?.code === '23503') {
      return NextResponse.json({ error: 'Selected goal does not exist.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not create investment.' }, { status: 500 });
  }
}
