/**
 * Chit fund schedule math: dual-rate / custom monthly payments,
 * pick-month P&amp;L, and monthly IRR (Newton).
 *
 * Installment rule (locked): months 1..pickMonth use the pre-pick amount;
 * months pickMonth+1..N use the post-pick amount.
 */

const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundRate = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

/** Preset matching the common 2.5L / 12-month dual-rate WhatsApp schedule. */
export const PRESET_2_5L_DUAL = {
  mode: 'dual_rate',
  chit_value: 250000,
  tenure_months: 12,
  pre_pick_amount: 20835,
  post_pick_amount: 23335,
  payouts: [
    240000, 242500, 245000, 247500, 250000, 252500,
    255000, 257500, 260000, 262500, 265000, 267500,
  ],
};

export function isChitInvestment(typeCode) {
  return String(typeCode || '').toUpperCase() === 'CHIT';
}

export function emptyCustomMonths(tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  return Array.from({ length: n }, () => ({ payment: 0, payout: 0 }));
}

export function normalizeChitDetails(raw, tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const mode = raw?.mode === 'custom' ? 'custom' : 'dual_rate';
  const pickMonth = Math.min(n, Math.max(1, Math.floor(Number(raw?.pick_month) || 1)));

  if (mode === 'custom') {
    const months = Array.from({ length: n }, (_, i) => {
      const row = raw?.months?.[i] || {};
      return {
        payment: roundMoney(row.payment),
        payout: roundMoney(row.payout),
      };
    });
    return {
      mode,
      chit_value: roundMoney(raw?.chit_value),
      pick_month: pickMonth,
      pick_month_payment: 'pre',
      months,
    };
  }

  const payouts = Array.from({ length: n }, (_, i) => roundMoney(raw?.payouts?.[i]));
  return {
    mode: 'dual_rate',
    chit_value: roundMoney(raw?.chit_value),
    pre_pick_amount: roundMoney(raw?.pre_pick_amount),
    post_pick_amount: roundMoney(raw?.post_pick_amount),
    payouts,
    pick_month: pickMonth,
    pick_month_payment: 'pre',
  };
}

export function validateChitDetails(details, tenureMonths) {
  const n = Math.floor(Number(tenureMonths) || 0);
  if (n < 1) return 'Chit tenure must be at least 1 month.';
  if (!details) return 'Chit schedule is required.';
  if (Number(details.chit_value) <= 0) return 'Chit value must be greater than zero.';

  const pick = Number(details.pick_month);
  if (!Number.isFinite(pick) || pick < 1 || pick > n) {
    return `Pick month must be between 1 and ${n}.`;
  }

  if (details.mode === 'custom') {
    if (!Array.isArray(details.months) || details.months.length !== n) {
      return 'Enter a payment and payout for every month.';
    }
    for (let i = 0; i < n; i += 1) {
      if (Number(details.months[i].payment) <= 0) {
        return `Month ${i + 1} payment must be greater than zero.`;
      }
      if (Number(details.months[i].payout) <= 0) {
        return `Month ${i + 1} payout must be greater than zero.`;
      }
    }
    return null;
  }

  if (Number(details.pre_pick_amount) <= 0) return 'Before-pick monthly amount must be greater than zero.';
  if (Number(details.post_pick_amount) <= 0) return 'After-pick monthly amount must be greater than zero.';
  if (!Array.isArray(details.payouts) || details.payouts.length !== n) {
    return 'Enter a payout amount for every month.';
  }
  for (let i = 0; i < n; i += 1) {
    if (Number(details.payouts[i]) <= 0) return `Month ${i + 1} payout must be greater than zero.`;
  }
  return null;
}

/**
 * Build per-month payment + payout rows for a chosen pick month.
 * Payment rule: pre through pick month; post from the next month.
 */
export function buildChitSchedule(details, tenureMonths, pickMonthOverride) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const pick = Math.min(n, Math.max(1, Math.floor(Number(pickMonthOverride ?? details?.pick_month) || 1)));
  const schedule = [];

  if (details?.mode === 'custom') {
    for (let month = 1; month <= n; month += 1) {
      const row = details.months?.[month - 1] || {};
      schedule.push({
        month,
        payment: roundMoney(row.payment),
        payout: roundMoney(row.payout),
      });
    }
    return schedule;
  }

  const pre = roundMoney(details?.pre_pick_amount);
  const post = roundMoney(details?.post_pick_amount);
  for (let month = 1; month <= n; month += 1) {
    schedule.push({
      month,
      payment: month <= pick ? pre : post,
      payout: roundMoney(details?.payouts?.[month - 1]),
    });
  }
  return schedule;
}

/** Monthly cashflows: −payment each month, +prize on pick month. */
export function buildChitCashflows(schedule, pickMonth) {
  const pick = Math.floor(Number(pickMonth));
  return schedule.map((row) => {
    let cf = -Number(row.payment || 0);
    if (row.month === pick) cf += Number(row.payout || 0);
    return roundMoney(cf);
  });
}

/**
 * Solve NPV(r) = 0 for monthly rate r using Newton-Raphson.
 * Cashflows are end-of-month for t = 1..N.
 */
export function solveMonthlyIrr(cashflows) {
  const cfs = (cashflows || []).map((v) => Number(v) || 0);
  if (cfs.length === 0) return null;

  const hasPos = cfs.some((v) => v > 0);
  const hasNeg = cfs.some((v) => v < 0);
  if (!hasPos || !hasNeg) return 0;

  const npv = (r) => {
    let total = 0;
    for (let t = 0; t < cfs.length; t += 1) {
      total += cfs[t] / Math.pow(1 + r, t + 1);
    }
    return total;
  };

  const dNpv = (r) => {
    let total = 0;
    for (let t = 0; t < cfs.length; t += 1) {
      const power = t + 1;
      total -= (power * cfs[t]) / Math.pow(1 + r, power + 1);
    }
    return total;
  };

  let r = 0.01;
  for (let i = 0; i < 80; i += 1) {
    const f = npv(r);
    const df = dNpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-14) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.99) {
      r = (r - 0.5) / 2;
      continue;
    }
    if (Math.abs(next - r) < 1e-10) {
      r = next;
      break;
    }
    r = next;
  }

  if (!Number.isFinite(r) || r <= -0.99 || r > 1) return null;
  return r;
}

export function summarizeChitPick(details, tenureMonths, pickMonth) {
  const schedule = buildChitSchedule(details, tenureMonths, pickMonth);
  const pick = Math.min(schedule.length, Math.max(1, Math.floor(Number(pickMonth) || 1)));
  const row = schedule[pick - 1];
  const prize = roundMoney(row?.payout);
  const totalPaid = roundMoney(schedule.reduce((sum, s) => sum + Number(s.payment || 0), 0));
  const profitLoss = roundMoney(prize - totalPaid);
  const cashflows = buildChitCashflows(schedule, pick);
  const monthlyRate = solveMonthlyIrr(cashflows);
  const monthlyRatePct = monthlyRate == null ? null : roundRate(monthlyRate * 100);
  const annualRatePct = monthlyRate == null ? null : roundRate((Math.pow(1 + monthlyRate, 12) - 1) * 100);

  return {
    pick_month: pick,
    schedule,
    prize,
    total_paid: totalPaid,
    profit_loss: profitLoss,
    monthly_rate_pct: monthlyRatePct,
    annual_rate_pct: annualRatePct,
    cashflows,
  };
}

export function compareAllPickMonths(details, tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const rows = [];
  for (let m = 1; m <= n; m += 1) {
    rows.push(summarizeChitPick(details, n, m));
  }
  return rows;
}

/** Persistable details + computed summary fields for API write. */
export function prepareChitForSave(rawDetails, tenureMonths) {
  const n = Math.floor(Number(tenureMonths) || 0);
  const details = normalizeChitDetails(rawDetails, n);
  const error = validateChitDetails(details, n);
  if (error) return { error };

  const summary = summarizeChitPick(details, n, details.pick_month);
  const saved = {
    ...details,
    summary: {
      prize: summary.prize,
      total_paid: summary.total_paid,
      profit_loss: summary.profit_loss,
      monthly_rate_pct: summary.monthly_rate_pct,
      annual_rate_pct: summary.annual_rate_pct,
    },
  };

  return {
    details: saved,
    summary,
    amount: details.chit_value,
    // Store monthly effective rate in rate_pct (CHIT-specific meaning).
    rate_pct: summary.monthly_rate_pct ?? 0,
    maturity_value: summary.prize,
    payment_frequency: 'monthly',
  };
}

export function totalChitPayments(details, tenureMonths, pickMonth) {
  const schedule = buildChitSchedule(details, tenureMonths, pickMonth ?? details?.pick_month);
  return roundMoney(schedule.reduce((sum, s) => sum + Number(s.payment || 0), 0));
}

export function chitPaymentsThroughMonth(details, tenureMonths, throughMonth, pickMonth) {
  const schedule = buildChitSchedule(details, tenureMonths, pickMonth ?? details?.pick_month);
  const upto = Math.max(0, Math.min(schedule.length, Math.floor(Number(throughMonth) || 0)));
  return roundMoney(schedule.slice(0, upto).reduce((sum, s) => sum + Number(s.payment || 0), 0));
}
