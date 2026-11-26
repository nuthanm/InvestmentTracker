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

/** Preset: 1.5L / 12-month auction chit, 5% commission on the discount. */
export const PRESET_1_5L_AUCTION = {
  mode: 'auction',
  chit_value: 150000,
  tenure_months: 12,
  commission_mode: 'commission',
  commission_pct: 5,
  commission_basis: 'discount',
  bids: [
    120000, 122500, 125000, 127500, 130000, 132500,
    135000, 137500, 140000, 142500, 145000, 150000,
  ],
};

/** How the foreman (owner) is paid in an auction chit. */
export const COMMISSION_MODES = [
  { value: 'owner', label: 'Owner chit only', hint: 'Owner takes month 1 in full. No commission after that.' },
  { value: 'owner_commission', label: 'Owner chit + commission', hint: 'Owner takes month 1, then a commission from every auction.' },
  { value: 'commission', label: 'Commission only', hint: 'No owner month. A commission is taken from every auction.' },
];

const COMMISSION_MODE_VALUES = COMMISSION_MODES.map((m) => m.value);

export function auctionHasOwnerMonth(details) {
  return details?.mode === 'auction' && (details.commission_mode === 'owner' || details.commission_mode === 'owner_commission');
}

/** Arithmetic series helper for auto-filling payouts / bids; optionally capped. */
export function steppedSeries(count, start, step, cap) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const s = Number(start) || 0;
  const d = Number(step) || 0;
  const max = Number(cap) > 0 ? Number(cap) : Infinity;
  return Array.from({ length: n }, (_, i) => roundMoney(Math.min(max, s + d * i)));
}

export function isChitInvestment(typeCode) {
  return String(typeCode || '').toUpperCase() === 'CHIT';
}

export function emptyCustomMonths(tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  return Array.from({ length: n }, () => ({ payment: 0, payout: 0 }));
}

export function normalizeChitDetails(raw, tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const mode = raw?.mode === 'custom' || raw?.mode === 'auction' ? raw.mode : 'dual_rate';
  const pickMonth = Math.min(n, Math.max(1, Math.floor(Number(raw?.pick_month) || 1)));

  if (mode === 'auction') {
    const pct = Number(raw?.commission_pct);
    return {
      mode,
      chit_value: roundMoney(raw?.chit_value),
      pick_month: pickMonth,
      pick_month_payment: 'pre',
      commission_mode: COMMISSION_MODE_VALUES.includes(raw?.commission_mode) ? raw.commission_mode : 'commission',
      commission_pct: Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 5,
      commission_basis: raw?.commission_basis === 'chit_value' ? 'chit_value' : 'discount',
      bids: Array.from({ length: n }, (_, i) => roundMoney(raw?.bids?.[i])),
    };
  }

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

  if (details.mode === 'auction') {
    const value = Number(details.chit_value);
    const owner = auctionHasOwnerMonth(details);
    if (owner && n < 2) return 'An owner chit needs at least 2 months.';
    if (owner && pick === 1) return 'Month 1 goes to the owner. Pick month 2 or later.';
    if (!Array.isArray(details.bids) || details.bids.length !== n) {
      return 'Enter the amount taken for every month.';
    }
    for (let i = owner ? 1 : 0; i < n; i += 1) {
      const bid = Number(details.bids[i]);
      if (bid <= 0) return `Month ${i + 1} amount taken must be greater than zero.`;
      if (bid > value) return `Month ${i + 1} amount taken cannot be more than the chit value.`;
    }
    return null;
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

  if (details?.mode === 'auction') {
    return buildAuctionRows(details, n);
  }

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

/**
 * Auction chit month rows. Every member pays (chit value / N) minus that
 * month's dividend; the dividend is (discount − commission) / N, where
 * discount = chit value − amount taken by that month's winner.
 * Owner month (month 1 in owner modes) is taken in full: no discount.
 */
export function buildAuctionRows(details, tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const value = Number(details?.chit_value) || 0;
  const base = value / n;
  const owner = auctionHasOwnerMonth(details);
  const takesCommission = details?.commission_mode !== 'owner';
  const pct = (Number(details?.commission_pct) || 0) / 100;
  const rows = [];

  for (let month = 1; month <= n; month += 1) {
    const ownerMonth = owner && month === 1;
    const taken = ownerMonth ? value : Math.min(value, Number(details?.bids?.[month - 1]) || 0);
    const discount = taken > 0 ? Math.max(0, value - taken) : 0;
    let commission = 0;
    if (!ownerMonth && takesCommission) {
      const raw = details?.commission_basis === 'chit_value' ? value * pct : discount * pct;
      commission = Math.min(discount, raw);
    }
    const dividend = (discount - commission) / n;
    rows.push({
      month,
      payment: roundMoney(base - dividend),
      payout: roundMoney(taken),
      discount: roundMoney(discount),
      commission: roundMoney(commission),
      dividend: roundMoney(dividend),
      owner_month: ownerMonth,
    });
  }
  return rows;
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
  const { kind, monthlyRate } = chitPickRate(schedule, pick, prize);
  const monthlyRatePct = monthlyRate == null ? null : roundRate(monthlyRate * 100);
  const annualRatePct = monthlyRate == null ? null : roundRate((Math.pow(1 + monthlyRate, 12) - 1) * 100);

  return {
    pick_month: pick,
    schedule,
    prize,
    total_paid: totalPaid,
    profit_loss: profitLoss,
    rate_kind: kind,
    monthly_rate_pct: monthlyRatePct,
    annual_rate_pct: annualRatePct,
    owner_month: !!row?.owner_month,
    cashflows,
  };
}

/**
 * Rate for one pick month, split so there is always one clear answer
 * (a single IRR over the whole chit breaks for middle months because
 * cash goes out, in, then out again).
 *
 * - Loan: you pay more than you get back and the prize exceeds what you
 *   had paid in by then. Loan = prize − paid so far, repaid by the
 *   remaining instalments. Rate = cost of that loan.
 * - Savings: otherwise. Instalments up to the pick month are your savings;
 *   at the pick month you get the prize less the instalments still due.
 *   Rate = return on those savings (negative if you lose money).
 */
export function chitPickRate(schedule, pickMonth, prize) {
  const pick = Math.min(schedule.length, Math.max(1, Math.floor(Number(pickMonth) || 1)));
  const before = schedule.slice(0, pick).map((s) => Number(s.payment || 0));
  const after = schedule.slice(pick).map((s) => Number(s.payment || 0));
  const paidThrough = before.reduce((a, b) => a + b, 0);
  const remaining = after.reduce((a, b) => a + b, 0);
  const x = Number(prize) || 0;
  const loss = x < paidThrough + remaining;

  if (loss && x > paidThrough && after.length) {
    const r = solveMonthlyIrr([x - paidThrough, ...after.map((v) => -v)]);
    return { kind: 'loan', monthlyRate: r };
  }

  const net = x - remaining;
  if (net <= 0) return { kind: 'savings', monthlyRate: null };
  const flows = before.map((v) => -v);
  flows[flows.length - 1] += net;
  return { kind: 'savings', monthlyRate: solveMonthlyIrr(flows) };
}

export function compareAllPickMonths(details, tenureMonths) {
  const n = Math.max(1, Math.floor(Number(tenureMonths) || 12));
  const rows = [];
  for (let m = 1; m <= n; m += 1) {
    rows.push(summarizeChitPick(details, n, m));
  }
  return rows;
}

/**
 * First month where you stop paying extra, and the best month to pick
 * (highest savings rate; if every month is a loan, the cheapest loan).
 */
export function chitPickInsights(rows) {
  const pickable = (rows || []).filter((r) => !r.owner_month && r.annual_rate_pct != null);
  const firstProfit = pickable.find((r) => Number(r.profit_loss) >= 0) || null;
  const savings = pickable.filter((r) => r.rate_kind === 'savings' && Number(r.profit_loss) >= 0);
  let best = null;
  if (savings.length) {
    best = savings.reduce((a, b) => (Number(b.annual_rate_pct) > Number(a.annual_rate_pct) ? b : a));
  } else if (pickable.length) {
    best = pickable.reduce((a, b) => (Number(b.annual_rate_pct) < Number(a.annual_rate_pct) ? b : a));
  }
  return {
    first_profit_month: firstProfit?.pick_month ?? null,
    best_month: best?.pick_month ?? null,
  };
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
      rate_kind: summary.rate_kind,
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
