import { computeMaturity, computeRecurringMaturity } from '@/lib/format';
import { isMarketInvestment, isMetalInvestment, isTransactionBased } from '@/lib/investments';

export const LIFECYCLE_STATUSES = {
  ACTIVE: 'active',
  MATURED: 'matured',
  CLOSED: 'closed',
  PREMATURE_WITHDRAWAL: 'premature_withdrawal',
};

export const LIFECYCLE_STATUS_OPTIONS = [
  { value: LIFECYCLE_STATUSES.ACTIVE, label: 'Active' },
  { value: LIFECYCLE_STATUSES.MATURED, label: 'Matured' },
  { value: LIFECYCLE_STATUSES.CLOSED, label: 'Closed / redeemed' },
  { value: LIFECYCLE_STATUSES.PREMATURE_WITHDRAWAL, label: 'Premature withdrawal' },
];

const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function isPrematureWithdrawalStatus(status) {
  return status === LIFECYCLE_STATUSES.PREMATURE_WITHDRAWAL;
}

export function isClosedLifecycleStatus(status) {
  return status === LIFECYCLE_STATUSES.CLOSED
    || status === LIFECYCLE_STATUSES.MATURED
    || isPrematureWithdrawalStatus(status);
}

export function getLifecycleLabel(status) {
  return LIFECYCLE_STATUS_OPTIONS.find((item) => item.value === status)?.label || 'Active';
}

function startOfDay(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function monthsElapsedBetween(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end || end < start) return 0;

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const anchor = new Date(start);
  anchor.setMonth(anchor.getMonth() + months);
  if (anchor > end) months -= 1;
  return Math.max(0, months);
}

export function investedPrincipalUntil(investment, asOfDate, investedOverride) {
  if (investedOverride != null) return Number(investedOverride) || 0;

  const amount = Number(investment.amount || 0);
  const frequency = investment.payment_frequency || 'lump_sum';
  const tenureMonths = Number(investment.tenure_months || 0);
  const asOf = startOfDay(asOfDate);
  const start = startOfDay(investment.start_date);
  if (!asOf || !start || asOf < start) return 0;

  if (frequency !== 'monthly' && frequency !== 'yearly') {
    return amount;
  }

  if (frequency === 'monthly') {
    const monthsDiff = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
    const dueThisMonth = new Date(start);
    dueThisMonth.setMonth(dueThisMonth.getMonth() + monthsDiff);
    const periods = Math.max(0, Math.min(monthsDiff + (dueThisMonth <= asOf ? 1 : 0), tenureMonths));
    return amount * periods;
  }

  const years = Math.floor(tenureMonths / 12);
  const yearsDiff = asOf.getFullYear() - start.getFullYear();
  const dueThisYear = new Date(start);
  dueThisYear.setFullYear(dueThisYear.getFullYear() + yearsDiff);
  const periods = Math.max(0, Math.min(yearsDiff + (dueThisYear <= asOf ? 1 : 0), years));
  return amount * periods;
}

export function computeRateBasedPrematureClosure(investment, {
  closureDate,
  appliedRatePct,
  penaltyPct = 0,
  penaltyOn = 'interest',
  investedOverride,
} = {}) {
  const asOf = closureDate || investment.closure_date || new Date().toISOString().slice(0, 10);
  const amount = Number(investment.amount || 0);
  const contractedRate = Number(investment.rate_pct || 0);
  const appliedRate = appliedRatePct != null ? Number(appliedRatePct) : contractedRate;
  const tenureMonths = Number(investment.tenure_months || 0) + (Number(investment.tenure_days || 0) / 30);
  const frequency = investment.payment_frequency || 'lump_sum';
  const compounding = investment.compounding || 'quarterly';
  const maturityValue = Number(investment.maturity_value || 0);
  const monthsHeld = monthsElapsedBetween(investment.start_date, asOf);
  const investedPrincipal = investedPrincipalUntil(investment, asOf, investedOverride);

  let estimatedValue;
  if (frequency === 'monthly' || frequency === 'yearly') {
    estimatedValue = computeRecurringMaturity({
      amountPerPeriod: amount,
      ratePct: appliedRate,
      months: Math.max(monthsHeld, 0.01),
      paymentFrequency: frequency,
    });
  } else {
    estimatedValue = computeMaturity({
      amount,
      ratePct: appliedRate,
      months: Math.max(monthsHeld, 0.01),
      compounding,
    });
  }

  const interestEarned = Math.max(estimatedValue - investedPrincipal, 0);
  const penaltyPctNum = Number(penaltyPct || 0);
  const penaltyAmount = penaltyOn === 'payout'
    ? estimatedValue * (penaltyPctNum / 100)
    : interestEarned * (penaltyPctNum / 100);
  const closureValue = Math.max(estimatedValue - penaltyAmount, 0);
  const benefitForfeited = Math.max(maturityValue - closureValue, 0);

  return {
    closureDate: asOf,
    monthsHeld,
    isBeforeMaturity: monthsHeld < tenureMonths,
    investedPrincipal: roundMoney(investedPrincipal),
    interestEarned: roundMoney(interestEarned),
    estimatedValue: roundMoney(estimatedValue),
    penaltyPct: penaltyPctNum,
    penaltyAmount: roundMoney(penaltyAmount),
    closureValue: roundMoney(closureValue),
    benefitForfeited: roundMoney(benefitForfeited),
    maturityValue: roundMoney(maturityValue),
    appliedRatePct: appliedRate,
    contractedRatePct: contractedRate,
  };
}

export function computeMarketPrematureClosure(investment, summary = {}, { closureDate } = {}) {
  const invested = Number(summary.invested_amount || 0);
  const redeemed = Number(summary.redeemed_amount || 0);
  const dividends = Number(summary.dividend_amount || 0);
  const realized = Number(summary.realized_gain_loss || 0);
  const closureValue = redeemed + dividends;
  const benefitForfeited = Math.max(invested - closureValue, 0);

  return {
    closureDate: closureDate || investment.closure_date || new Date().toISOString().slice(0, 10),
    investedPrincipal: roundMoney(invested),
    closureValue: roundMoney(closureValue),
    redeemedAmount: roundMoney(redeemed),
    dividendAmount: roundMoney(dividends),
    realizedGainLoss: roundMoney(realized),
    benefitForfeited: roundMoney(Math.abs(realized < 0 ? realized : 0)),
    isFullyRedeemed: Boolean(summary.is_closed),
  };
}

export function computePrematureClosurePreview(investment, options = {}, summary = null) {
  if (isTransactionBased(investment.type_code)) {
    return {
      kind: isMetalInvestment(investment.type_code) ? 'metal' : 'market',
      ...computeMarketPrematureClosure(investment, summary || {}, options),
    };
  }

  return {
    kind: 'rate_based',
    ...computeRateBasedPrematureClosure(investment, options),
  };
}

export function validateLifecycleUpdate({
  lifecycleStatus,
  closureDate,
  closureAmount,
  investment,
  summary,
}) {
  if (!LIFECYCLE_STATUS_OPTIONS.some((item) => item.value === lifecycleStatus)) {
    return 'Pick a valid lifecycle status.';
  }

  if (lifecycleStatus === LIFECYCLE_STATUSES.ACTIVE) {
    return null;
  }

  if (!closureDate) return 'Closure date is required when marking an investment closed.';

  const closure = startOfDay(closureDate);
  const start = startOfDay(investment.start_date);
  if (!closure || !start) return 'Closure date is invalid.';
  if (closure < start) return 'Closure date cannot be before the investment start date.';

  if (isPrematureWithdrawalStatus(lifecycleStatus)) {
    if (investment.maturity_date) {
      const maturity = startOfDay(investment.maturity_date);
      if (maturity && closure >= maturity) {
        return 'Premature withdrawal applies only before maturity. Use Matured or Closed instead.';
      }
    }

    if (!isTransactionBased(investment.type_code)) {
      const tenureMonths = Number(investment.tenure_months || 0);
      const monthsHeld = monthsElapsedBetween(investment.start_date, closureDate);
      if (monthsHeld <= 0) return 'Investment must be held for at least one month before premature withdrawal.';
      if (tenureMonths > 0 && monthsHeld >= tenureMonths) {
        return 'Premature withdrawal applies only before the planned tenure ends.';
      }
    } else if (summary && !summary.is_closed) {
      return 'Fully redeem or sell holdings before marking a market/metal investment as prematurely withdrawn.';
    }
  }

  if (closureAmount != null && Number(closureAmount) < 0) {
    return 'Closure amount cannot be negative.';
  }

  return null;
}
