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

export function isNaturallyMatured(investment) {
  if (!investment?.maturity_date) return false;
  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) return false;
  if (investment.auto_renew) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maturity = new Date(investment.maturity_date);
  maturity.setHours(0, 0, 0, 0);
  return maturity <= today;
}

/** Effective lifecycle status — stored value, or inferred from position / maturity date. */
export function resolveLifecycleStatus(investment) {
  const stored = investment?.lifecycle_status || LIFECYCLE_STATUSES.ACTIVE;
  if (isClosedLifecycleStatus(stored)) return stored;
  if (investment?.is_closed) return LIFECYCLE_STATUSES.CLOSED;
  if (isNaturallyMatured(investment)) return LIFECYCLE_STATUSES.MATURED;
  return LIFECYCLE_STATUSES.ACTIVE;
}

export function isActiveInvestment(investment) {
  return resolveLifecycleStatus(investment) === LIFECYCLE_STATUSES.ACTIVE;
}

export function isClosedInvestment(investment) {
  return !isActiveInvestment(investment);
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

export function daysHeldBetween(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end || end < start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function monthsElapsedBetween(startDate, endDate) {
  const days = daysHeldBetween(startDate, endDate);
  return days / 30.4375;
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

function computeAccumulatedValue(investment, {
  ratePct,
  closureDate,
  investedPrincipal,
  monthsHeld,
}) {
  const amount = Number(investment.amount || 0);
  const frequency = investment.payment_frequency || 'lump_sum';
  const compounding = investment.compounding || 'quarterly';
  const months = Math.max(monthsHeld, 1 / 30.4375);

  if (frequency === 'monthly' || frequency === 'yearly') {
    return computeRecurringMaturity({
      amountPerPeriod: amount,
      ratePct,
      months,
      paymentFrequency: frequency,
    });
  }

  return computeMaturity({
    amount: investedPrincipal,
    ratePct,
    months,
    compounding,
  });
}

export function computeRateBasedPrematureClosure(investment, {
  closureDate,
  appliedRatePct,
  penaltyAmount = 0,
  penaltyPct = 0,
  investedOverride,
} = {}) {
  const asOf = closureDate || investment.closure_date || new Date().toISOString().slice(0, 10);
  const contractedRate = Number(investment.rate_pct || 0);
  const effectiveRate = appliedRatePct != null ? Number(appliedRatePct) : contractedRate;
  const tenureMonths = Number(investment.tenure_months || 0) + (Number(investment.tenure_days || 0) / 30);
  const maturityValue = Number(investment.maturity_value || 0);
  const monthsHeld = monthsElapsedBetween(investment.start_date, asOf);
  const daysHeld = daysHeldBetween(investment.start_date, asOf);
  const investedPrincipal = investedPrincipalUntil(investment, asOf, investedOverride);

  const valueAtContractedRate = computeAccumulatedValue(investment, {
    ratePct: contractedRate,
    closureDate: asOf,
    investedPrincipal,
    monthsHeld,
  });
  const valueAtEffectiveRate = computeAccumulatedValue(investment, {
    ratePct: effectiveRate,
    closureDate: asOf,
    investedPrincipal,
    monthsHeld,
  });

  const interestAtContractedRate = Math.max(valueAtContractedRate - investedPrincipal, 0);
  const interestAtEffectiveRate = Math.max(valueAtEffectiveRate - investedPrincipal, 0);
  const rateDifferentialLoss = Math.max(interestAtContractedRate - interestAtEffectiveRate, 0);

  const flatPenalty = Number(penaltyAmount || 0);
  const pctPenalty = Number(penaltyPct || 0) > 0
    ? interestAtEffectiveRate * (Number(penaltyPct) / 100)
    : 0;
  const resolvedPenaltyAmount = flatPenalty > 0 ? flatPenalty : pctPenalty;

  const closureValue = Math.max(investedPrincipal + interestAtEffectiveRate - resolvedPenaltyAmount, 0);
  const interestLoss = Math.max(maturityValue - (investedPrincipal + interestAtEffectiveRate), 0);
  const totalPrematureCost = interestLoss + resolvedPenaltyAmount;
  const benefitForfeited = Math.max(maturityValue - closureValue, 0);

  return {
    closureDate: asOf,
    daysHeld,
    monthsHeld: roundMoney(monthsHeld),
    isBeforeMaturity: monthsHeld < tenureMonths,
    investedPrincipal: roundMoney(investedPrincipal),
    contractedRatePct: contractedRate,
    appliedRatePct: effectiveRate,
    effectiveRatePct: effectiveRate,
    interestAtContractedRate: roundMoney(interestAtContractedRate),
    interestAtEffectiveRate: roundMoney(interestAtEffectiveRate),
    interestEarned: roundMoney(interestAtEffectiveRate),
    rateDifferentialLoss: roundMoney(rateDifferentialLoss),
    interestLoss: roundMoney(interestLoss),
    penaltyPct: Number(penaltyPct || 0),
    penaltyAmount: roundMoney(resolvedPenaltyAmount),
    closureValue: roundMoney(closureValue),
    totalPrematureCost: roundMoney(totalPrematureCost),
    benefitForfeited: roundMoney(benefitForfeited),
    maturityValue: roundMoney(maturityValue),
    estimatedValue: roundMoney(valueAtEffectiveRate),
  };
}

export function computeMarketPrematureClosure(investment, summary = {}, { closureDate } = {}) {
  const invested = Number(summary.invested_amount || 0);
  const redeemed = Number(summary.redeemed_amount || 0);
  const dividends = Number(summary.dividend_amount || 0);
  const realized = Number(summary.realized_gain_loss || 0);
  const closureValue = redeemed + dividends;

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
      if (daysHeldBetween(investment.start_date, closureDate) <= 0) {
        return 'Investment must be held for at least one day before premature withdrawal.';
      }
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
