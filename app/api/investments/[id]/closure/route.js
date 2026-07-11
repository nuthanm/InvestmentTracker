import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isTransactionBased } from '@/lib/investments';
import {
  LIFECYCLE_STATUSES,
  computePrematureClosurePreview,
  validateLifecycleUpdate,
} from '@/lib/investment-lifecycle';

function missingLifecycleColumns(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('lifecycle_status') && msg.includes('does not exist');
}

function parseDateInput(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export async function PATCH(req, { params }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const rows = await sql`
      SELECT *
      FROM investments
      WHERE id = ${params.id} AND user_id = ${me.id}
      LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const investment = rows[0];
    const body = await req.json();
    const lifecycleStatus = body.lifecycle_status || LIFECYCLE_STATUSES.ACTIVE;
    const closureDate = body.closure_date ? parseDateInput(body.closure_date) : null;
    const closureAmount = body.closure_amount != null && body.closure_amount !== ''
      ? Number(body.closure_amount)
      : null;

    let summary = null;
    if (isTransactionBased(investment.type_code)) {
      const transactions = await sql`
        SELECT transaction_type, trade_date, units, price_per_unit, total_amount, charges, taxes, created_at, id
        FROM investment_transactions
        WHERE investment_id = ${params.id} AND user_id = ${me.id}
        ORDER BY trade_date ASC, created_at ASC
      `;
      const { summarizeMarketTransactions } = await import('@/lib/investments');
      summary = summarizeMarketTransactions(transactions);
    }

    const validationError = validateLifecycleUpdate({
      lifecycleStatus,
      closureDate,
      closureAmount,
      investment,
      summary,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const penaltyPct = body.penalty_pct != null && body.penalty_pct !== '' ? Number(body.penalty_pct) : null;
    const appliedRatePct = body.applied_rate_pct != null && body.applied_rate_pct !== ''
      ? Number(body.applied_rate_pct)
      : null;

    let penaltyAmount = body.penalty_amount != null && body.penalty_amount !== ''
      ? Number(body.penalty_amount)
      : null;

    let preview = null;
    if (lifecycleStatus !== LIFECYCLE_STATUSES.ACTIVE) {
      preview = computePrematureClosurePreview(investment, {
        closureDate,
        appliedRatePct,
        penaltyAmount: penaltyAmount ?? 0,
        penaltyPct: penaltyPct ?? 0,
        investedOverride: body.invested_override,
      }, summary);

      if (penaltyAmount == null && preview.penaltyAmount != null) {
        penaltyAmount = preview.penaltyAmount;
      }
    }

    const resolvedClosureAmount = lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE
      ? null
      : (closureAmount ?? preview?.closureValue ?? null);

    const resolvedInterestLoss = lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE
      ? null
      : (preview?.interestLoss ?? null);

    const updated = await sql`
      UPDATE investments
      SET
        lifecycle_status = ${lifecycleStatus},
        closure_date = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : closureDate},
        closure_amount = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : resolvedClosureAmount},
        applied_rate_pct = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : appliedRatePct},
        penalty_pct = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : penaltyPct},
        penalty_amount = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : penaltyAmount},
        interest_loss = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : resolvedInterestLoss},
        closure_notes = ${lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE ? null : (body.closure_notes?.trim() || null)}
      WHERE id = ${params.id} AND user_id = ${me.id}
      RETURNING *
    `;

    return NextResponse.json({ investment: updated[0], preview });
  } catch (err) {
    if (missingLifecycleColumns(err)) {
      return NextResponse.json({
        error: 'Investment lifecycle is not available yet. Run db/migrations/2026-07-11-add-investment-lifecycle.sql in Neon SQL Editor.',
      }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Could not update closure details.' }, { status: 500 });
  }
}
