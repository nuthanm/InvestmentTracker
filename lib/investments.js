export const MARKET_TYPE_CODES = ['MF', 'ST', 'ETF'];

export const METAL_TYPE_CODES = ['GOLD', 'SILV'];

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

export function effectiveInvestedAmount(investment) {
  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) {
    return Number(investment.invested_amount || 0);
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
    const monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    const dueThisMonth = new Date(start);
    dueThisMonth.setMonth(dueThisMonth.getMonth() + monthsDiff);
    const monthsElapsed = Math.max(0, Math.min(monthsDiff + (dueThisMonth <= today ? 1 : 0), tenureMonths));
    return amount * monthsElapsed;
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
  if (isMarketInvestment(investment.type_code) || isMetalInvestment(investment.type_code)) {
    return Number(investment.current_value || 0);
  }
  return Number(investment.maturity_value || investment.amount || 0);
}

export function effectiveReturnsValue(investment) {
  return effectiveCurrentValue(investment) - effectiveInvestedAmount(investment);
}
