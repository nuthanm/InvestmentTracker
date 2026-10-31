function yearsBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) / 365.25);
}

export function isLiquidityGoal(goal) {
  const value = goal?.for_liquidity;
  return value === true || value === 't' || value === 'true' || value === 1 || value === '1';
}

/** Cash to keep available, grown by inflation since the amount was set. */
export function liquidityRequiredAmount(goal, asOf = new Date()) {
  const base = Number(goal?.target_amount || 0);
  if (!base || base <= 0) return 0;
  const rate = Number(goal?.inflation_pct || 0);
  if (!rate) return base;
  const years = yearsBetween(goal?.amount_as_of || goal?.created_at, asOf);
  return Math.round(base * Math.pow(1 + rate / 100, years) * 100) / 100;
}

export function goalTargetAmount(goal, asOf = new Date()) {
  if (isLiquidityGoal(goal)) return liquidityRequiredAmount(goal, asOf);
  return Number(goal?.target_amount || 0);
}
