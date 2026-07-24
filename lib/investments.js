import {
  buildChitSchedule,
  chitPaymentsThroughMonth,
  isChitInvestment,
  totalChitPayments,
} from '@/lib/chit';

export const MARKET_TYPE_CODES = ['MF', 'ST', 'ETF'];

export const METAL_TYPE_CODES = ['GOLD', 'SILV'];

export { isChitInvestment };

export const METAL_TRANSACTION_TYPES = [
  { value: 'buy',  label: 'Purchase' },
  { value: 'sell', label: 'Sell' },
];

export const MARKET_TRANSACTION_TYPES = [
  { value: 'buy', label: 'Buy' },
  { value: 'redeem', label: 'Redeem / Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'bonus', label: 'Bonus units' },
  { value: 'split', label: 'Split adjustment' },
  { value: 'switch_in', label: 'Switch in' },
  { value: 'switch_out', label: 'Switch out' },
];

const BUY_TYPES = new Set(['buy', 'switch_in']);
const SELL_TYPES = new Set(['redeem', 'sell', 'switch_out']);
const ZERO_COST_UNIT_TYPES = new Set(['bonus', 'split']);

const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundUnits = (n) => Math.round((Number(n) || 0) * 1000000) / 1000000;

export function isMarketInvestment(typeCode) {
  return MARKET_TYPE_CODES.includes(typeCode);
}

export function isMetalInvestment(typeCode) {
  return METAL_TYPE_CODES.includes(typeCode);
}

export function isTransactionBased(typeCode) {
  return isMarketInvestment(typeCode) || isMetalInvestment(typeCode);
}

export function getTransactionTypeLabel(type) {
  return MARKET_TRANSACTION_TYPES.find((item) => item.value === type)?.label
    || METAL_TRANSACTION_TYPES.find((item) => item.value === type)?.label
    || type;
}

export function computeTransactionGross(tx) {
  const totalAmount = Number(tx?.total_amount);
  if (Number.isFinite(totalAmount) && totalAmount > 0) return roundMoney(totalAmount);
  return roundMoney((Number(tx?.units) || 0) * (Number(tx?.price_per_unit) || 0));
}

export function computeTransactionNetAmount(tx) {
  const gross = computeTransactionGross(tx);
  const charges = Number(tx?.charges) || 0;
  const taxes = Number(tx?.taxes) || 0;
  const type = String(tx?.transaction_type || '').toLowerCase();

  if (BUY_TYPES.has(type)) return roundMoney(gross + charges + taxes);
  if (SELL_TYPES.has(type)) return roundMoney(gross - charges - taxes);
  return roundMoney(gross);
}

export function summarizeMarketTransactions(transactions = []) {
  const ordered = [...transactions].sort((a, b) => {
    const dateDiff = String(a.trade_date || '').localeCompare(String(b.trade_date || ''));
    if (dateDiff !== 0) return dateDiff;
    return String(a.created_at || a.id || '').localeCompare(String(b.created_at || b.id || ''));
  });

  let totalUnits = 0;
  let remainingCostBasis = 0;
  let investedAmount = 0;
  let redeemedAmount = 0;
  let dividendAmount = 0;
  let realizedGainLoss = 0;

  for (const tx of ordered) {
    const type = String(tx.transaction_type || '').toLowerCase();
    const units = Number(tx.units) || 0;
    const netAmount = computeTransactionNetAmount(tx);

    if (BUY_TYPES.has(type)) {
      investedAmount += netAmount;
      totalUnits += units;
      remainingCostBasis += netAmount;
      continue;
    }

    if (SELL_TYPES.has(type)) {
      const avgCost = totalUnits > 0 ? remainingCostBasis / totalUnits : 0;
      const costSold = avgCost * units;
      totalUnits -= units;
      remainingCostBasis -= costSold;
      if (Math.abs(totalUnits) < 0.000001) totalUnits = 0;
      if (Math.abs(remainingCostBasis) < 0.01) remainingCostBasis = 0;
      redeemedAmount += netAmount;
      realizedGainLoss += netAmount - costSold;
      continue;
    }

    if (type === 'dividend') {
      dividendAmount += netAmount;
      continue;
    }

    if (ZERO_COST_UNIT_TYPES.has(type)) {
      totalUnits += units;
    }
  }

  if (totalUnits < 0) totalUnits = 0;
  if (remainingCostBasis < 0) remainingCostBasis = 0;

  const averageBuyPrice = totalUnits > 0 ? remainingCostBasis / totalUnits : 0;
  const currentValue = remainingCostBasis + redeemedAmount + dividendAmount;

  return {
    total_units: roundUnits(totalUnits),
    invested_amount: roundMoney(investedAmount),
    redeemed_amount: roundMoney(redeemedAmount),
    dividend_amount: roundMoney(dividendAmount),
    realized_gain_loss: roundMoney(realizedGainLoss),
    remaining_cost_basis: roundMoney(remainingCostBasis),
    average_buy_price: roundMoney(averageBuyPrice),
    current_value: roundMoney(currentValue),
    has_open_units: totalUnits > 0,
    is_closed: totalUnits === 0 && ordered.length > 0,
    market_transaction_count: ordered.length,
  };
}

function startOfDay(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function buildRecurringPaymentSchedule(investment) {
  const frequency = investment?.payment_frequency;
  if (frequency !== 'monthly' && frequency !== 'yearly') return [];
  if (!investment?.start_date) return [];

  const start = new Date(investment.start_date);
  const tenureMonths = Number(investment.tenure_months || 0);
  const amount = Number(investment.amount || 0);
  const schedule = [];

  if (frequency === 'monthly') {
    const chitRows = isChitInvestment(investment.type_code) && investment.chit_details
      ? buildChitSchedule(investment.chit_details, tenureMonths, investment.chit_details?.pick_month)
      : null;

    for (let monthIndex = 0; monthIndex < tenureMonths; monthIndex += 1) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + monthIndex);
      schedule.push({
        period_label: due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        due_date: due.toISOString().slice(0, 10),
        amount: chitRows ? Number(chitRows[monthIndex]?.payment || 0) : amount,
        chit_month: monthIndex + 1,
      });
    }
    return schedule;
  }

  const years = Math.floor(tenureMonths / 12);
  for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
    const due = new Date(start);
    due.setFullYear(due.getFullYear() + yearIndex);
    const startYear = due.getFullYear();
    schedule.push({
      period_label: `${startYear}-${String(startYear + 1).slice(2)}`,
      due_date: due.toISOString().slice(0, 10),
      amount,
    });
  }

  return schedule;
}

export function summarizeRecurringPaymentProgress(investment, paymentRecords = [], asOfDate = new Date()) {
  const schedule = buildRecurringPaymentSchedule(investment);
  if (!schedule.length) return null;

  const today = startOfDay(asOfDate);
  const recordsByPeriod = new Map(paymentRecords.map((record) => [String(record.period_label), record]));

  let paidCount = 0;
  let overdueCount = 0;
  let nextDue = null;

  for (const slot of schedule) {
    const record = recordsByPeriod.get(String(slot.period_label));
    if (record?.paid) {
      paidCount += 1;
      continue;
    }

    const dueDate = startOfDay(slot.due_date);
    if (dueDate && today && dueDate < today) overdueCount += 1;
    if (!nextDue) nextDue = { ...slot, dueDate };
  }

  if (!nextDue) {
    return {
      payment_schedule_length: schedule.length,
      payment_paid_count: paidCount,
      payment_overdue_count: overdueCount,
      next_due_date: null,
      next_due_period_label: null,
      next_due_days: null,
      next_due_is_due_today: false,
      next_due_is_overdue: false,
    };
  }

  const nextDueDays = nextDue.dueDate && today ? Math.round((nextDue.dueDate - today) / DAY_MS) : null;

  return {
    payment_schedule_length: schedule.length,
    payment_paid_count: paidCount,
    payment_overdue_count: overdueCount,
    next_due_date: nextDue.due_date,
    next_due_period_label: nextDue.period_label,
    next_due_days: nextDueDays,
    next_due_is_due_today: nextDueDays === 0,
    next_due_is_overdue: nextDueDays != null && nextDueDays < 0,
  };
}

export function attachRecurringPaymentSummaries(investments = [], paymentRecords = []) {
  const grouped = new Map();
  for (const record of paymentRecords) {
    const key = String(record.investment_id);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(record);
    else grouped.set(key, [record]);
  }

  return investments.map((investment) => {
    if (investment.payment_frequency !== 'monthly' && investment.payment_frequency !== 'yearly') return investment;
    const summary = summarizeRecurringPaymentProgress(investment, grouped.get(String(investment.id)) || []);
    return summary ? { ...investment, ...summary } : investment;
  });
}

export function attachInvestmentSummaries(investments = [], transactions = []) {
  const grouped = new Map();
  for (const tx of transactions) {
    const key = String(tx.investment_id);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(tx);
    else grouped.set(key, [tx]);
  }

  return investments.map((investment) => {
    if (!isMarketInvestment(investment.type_code) && !isMetalInvestment(investment.type_code)) return investment;
    return {
      ...investment,
      ...summarizeMarketTransactions(grouped.get(String(investment.id)) || []),
    };
  });
}

function monthsElapsedOnSchedule(investment, asOfDate = new Date()) {
  const start = new Date(investment.start_date);
  start.setHours(0, 0, 0, 0);
  const today = new Date(asOfDate);
  today.setHours(0, 0, 0, 0);
  if (today < start) return 0;

  const tenureMonths = Number(investment.tenure_months || 0);
  const monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  const dueThisMonth = new Date(start);
  dueThisMonth.setMonth(dueThisMonth.getMonth() + monthsDiff);
  return Math.max(0, Math.min(monthsDiff + (dueThisMonth <= today ? 1 : 0), tenureMonths));
}

export function effectiveInvestedAmount(investment) {
  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) {
    return Number(investment.invested_amount || 0);
  }

  if (isChitInvestment(investment.type_code) && investment.chit_details) {
    const fromSummary = Number(investment.chit_details?.summary?.total_paid);
    if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary;
    return totalChitPayments(investment.chit_details, investment.tenure_months, investment.chit_details?.pick_month);
  }

  const amount = Number(investment.amount || 0);
  const frequency = investment.payment_frequency || 'lump_sum';
  const tenureMonths = Number(investment.tenure_months || 0);

  if (frequency === 'monthly') return amount * tenureMonths;
  if (frequency === 'yearly') return amount * Math.floor(tenureMonths / 12);
  return amount;
}

export function effectiveInvestedSoFar(investment) {
  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) {
    return Number(investment.invested_amount || 0);
  }

  const amount = Number(investment.amount || 0);
  const frequency = investment.payment_frequency || 'lump_sum';
  const tenureMonths = Number(investment.tenure_months || 0);

  if (isChitInvestment(investment.type_code) && investment.chit_details) {
    if (!investment.start_date) {
      return totalChitPayments(investment.chit_details, tenureMonths, investment.chit_details?.pick_month);
    }
    const elapsed = monthsElapsedOnSchedule(investment);
    return chitPaymentsThroughMonth(
      investment.chit_details,
      tenureMonths,
      elapsed,
      investment.chit_details?.pick_month
    );
  }

  if (frequency !== 'monthly' && frequency !== 'yearly') {
    return amount;
  }

  if (!investment.start_date) {
    return frequency === 'monthly' ? amount * tenureMonths : amount * Math.floor(tenureMonths / 12);
  }

  const start = new Date(investment.start_date);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < start) return 0;

  if (frequency === 'monthly') {
    return amount * monthsElapsedOnSchedule(investment);
  }

  // yearly
  const years = Math.floor(tenureMonths / 12);
  const yearsDiff = today.getFullYear() - start.getFullYear();
  const dueThisYear = new Date(start);
  dueThisYear.setFullYear(dueThisYear.getFullYear() + yearsDiff);
  const yearsElapsed = Math.max(0, Math.min(yearsDiff + (dueThisYear <= today ? 1 : 0), years));
  return amount * yearsElapsed;
}

export function effectiveCurrentValue(investment) {
  if (Number(investment.closure_amount) > 0 && investment.lifecycle_status && investment.lifecycle_status !== 'active') {
    return Number(investment.closure_amount);
  }

  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) {
    return Number(investment.current_value || 0);
  }

  if (isChitInvestment(investment.type_code) && investment.chit_details) {
    const pickMonth = Number(investment.chit_details?.pick_month || 0);
    const elapsed = investment.start_date ? monthsElapsedOnSchedule(investment) : 0;
    if (pickMonth > 0 && elapsed >= pickMonth) {
      return Number(investment.maturity_value || investment.chit_details?.summary?.prize || 0);
    }
    return effectiveInvestedSoFar(investment);
  }

  return Number(investment.maturity_value || investment.amount || 0);
}

export function effectiveReturnsValue(investment) {
  return effectiveCurrentValue(investment) - effectiveInvestedAmount(investment);
}
