import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isRecurringFrequency } from '@/lib/investments';
import { isClosedLifecycleStatus } from '@/lib/investment-lifecycle';
import { inr } from '@/lib/format';

const MIGRATION = 'db/migrations/2026-10-17-add-partial-withdrawals.sql';

function missingWithdrawalsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('partial_withdrawals') && msg.includes('does not exist');
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function todayDateOnly() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${month}-${day}`;
}

async function loadInvestment(userId, investmentId) {
  const rows = await sql`
    SELECT id, type_code, payment_frequency, start_date, lifecycle_status
    FROM investments
    WHERE id = ${investmentId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function paidAndWithdrawn(userId, investmentId) {
  const [paidRows, withdrawnRows] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payment_records
      WHERE investment_id = ${investmentId} AND user_id = ${userId} AND paid = TRUE
    `,
    sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM partial_withdrawals
      WHERE investment_id = ${investmentId} AND user_id = ${userId}
    `,
  ]);
  const paid = roundMoney(paidRows[0]?.total);
  const withdrawn = roundMoney(withdrawnRows[0]?.total);
  return { paid, withdrawn, still: roundMoney(Math.max(0, paid - withdrawn)) };
}

export async function GET(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadInvestment(me.id, params.id);
  if (!investment) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  try {
    const rows = await sql`
      SELECT id, amount, withdrawn_on, notes, created_at
      FROM partial_withdrawals
      WHERE investment_id = ${params.id} AND user_id = ${me.id}
      ORDER BY withdrawn_on ASC, created_at ASC
    `;
    let totals = { paid: 0, withdrawn: 0, still: 0 };
    try {
      totals = await paidAndWithdrawn(me.id, params.id);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (!(msg.includes('payment_records') && msg.includes('does not exist'))) throw err;
    }
    return NextResponse.json({
      withdrawals: rows.map((row) => ({
        id: row.id,
        amount: roundMoney(row.amount),
        withdrawn_on: dateOnly(row.withdrawn_on),
        notes: row.notes || '',
      })),
      paid_total: totals.paid,
      withdrawn_total: totals.withdrawn,
      still_invested: totals.still,
      writable: !isClosedLifecycleStatus(investment.lifecycle_status),
    });
  } catch (err) {
    if (missingWithdrawalsTable(err)) {
      return NextResponse.json({
        withdrawals: [],
        paid_total: 0,
        withdrawn_total: 0,
        still_invested: 0,
        writable: false,
        warning: `Partial withdrawals are not available yet. Run ${MIGRATION} in Neon SQL Editor.`,
      });
    }
    console.error('partial withdrawals list error', err);
    return NextResponse.json({ error: 'Could not load partial withdrawals.' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadInvestment(me.id, params.id);
  if (!investment) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!isRecurringFrequency(investment.payment_frequency)) {
    return NextResponse.json({ error: 'Partial withdrawal is only for a recurring plan such as an RD.' }, { status: 400 });
  }
  if (isClosedLifecycleStatus(investment.lifecycle_status)) {
    return NextResponse.json({ error: 'This plan is closed. A partial withdrawal keeps the same plan open.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const amount = roundMoney(body.amount);
    const withdrawnOn = typeof body.withdrawn_on === 'string' ? body.withdrawn_on.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Withdrawal amount must be greater than zero.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(withdrawnOn)) {
      return NextResponse.json({ error: 'Withdrawal date is required.' }, { status: 400 });
    }
    if (withdrawnOn > todayDateOnly()) {
      return NextResponse.json({ error: 'Withdrawal date cannot be in the future.' }, { status: 400 });
    }
    const started = dateOnly(investment.start_date);
    if (started && withdrawnOn < started) {
      return NextResponse.json({ error: 'Withdrawal date cannot be before the plan started.' }, { status: 400 });
    }
    if (notes.length > 500) {
      return NextResponse.json({ error: 'Note must be 500 characters or less.' }, { status: 400 });
    }

    const totals = await paidAndWithdrawn(me.id, params.id);
    if (amount > totals.still + 0.001) {
      return NextResponse.json({
        error: totals.still > 0
          ? `You can withdraw up to ${inr(totals.still)}, the amount still invested from checked instalments.`
          : 'Mark the instalments you have paid before recording a withdrawal.',
      }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO partial_withdrawals (investment_id, user_id, amount, withdrawn_on, notes)
      VALUES (${params.id}, ${me.id}, ${amount}, ${withdrawnOn}, ${notes || null})
      RETURNING id, amount, withdrawn_on, notes
    `;
    const still = roundMoney(totals.still - amount);
    return NextResponse.json({
      withdrawal: {
        id: rows[0].id,
        amount: roundMoney(rows[0].amount),
        withdrawn_on: dateOnly(rows[0].withdrawn_on),
        notes: rows[0].notes || '',
      },
      paid_total: totals.paid,
      withdrawn_total: roundMoney(totals.withdrawn + amount),
      still_invested: still,
    });
  } catch (err) {
    if (missingWithdrawalsTable(err)) {
      return NextResponse.json(
        { error: `Partial withdrawals are not available yet. Run ${MIGRATION} in Neon SQL Editor.` },
        { status: 409 }
      );
    }
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('payment_records') && msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Payment records are not available yet, so a withdrawal cannot be matched to checked instalments.' },
        { status: 409 }
      );
    }
    console.error('partial withdrawal create error', err);
    return NextResponse.json({ error: 'Could not record the withdrawal.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const investment = await loadInvestment(me.id, params.id);
  if (!investment) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  try {
    const { searchParams } = new URL(req.url);
    const withdrawalId = searchParams.get('withdrawalId');
    if (!withdrawalId) return NextResponse.json({ error: 'Withdrawal id is required.' }, { status: 400 });

    const removed = await sql`
      DELETE FROM partial_withdrawals
      WHERE id = ${withdrawalId} AND investment_id = ${params.id} AND user_id = ${me.id}
      RETURNING id
    `;
    if (removed.length === 0) return NextResponse.json({ error: 'Withdrawal not found.' }, { status: 404 });

    let totals = { paid: 0, withdrawn: 0, still: 0 };
    try {
      totals = await paidAndWithdrawn(me.id, params.id);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (!(msg.includes('payment_records') && msg.includes('does not exist'))) throw err;
    }
    return NextResponse.json({
      ok: true,
      paid_total: totals.paid,
      withdrawn_total: totals.withdrawn,
      still_invested: totals.still,
    });
  } catch (err) {
    if (missingWithdrawalsTable(err)) {
      return NextResponse.json(
        { error: `Partial withdrawals are not available yet. Run ${MIGRATION} in Neon SQL Editor.` },
        { status: 409 }
      );
    }
    console.error('partial withdrawal delete error', err);
    return NextResponse.json({ error: 'Could not remove the withdrawal.' }, { status: 500 });
  }
}
