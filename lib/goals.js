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

export function isRecurringYearlyGoal(goal) {
  const value = goal?.recurring_yearly;
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

/** Null / missing goal_year means a common (ongoing) goal. */
export function isCommonGoal(goal) {
  const year = goalScopeYear(goal);
  return year == null;
}

/** Calendar year for a year-scoped goal, or null for common goals. */
export function goalScopeYear(goal) {
  if (goal == null || goal.goal_year == null || goal.goal_year === '') return null;
  const year = Number(goal.goal_year);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return Math.trunc(year);
}

/**
 * Outcome bucket for charts and filters.
 * - completed: funding progress >= 100%
 * - pending: not completed and still open (no date, liquidity, or date in the future)
 * - not_yet: not completed and target date has passed
 */
export function goalOutcomeStatus(goal, asOf = new Date()) {
  const current = Number(goal?.current_amount || 0);
  const target = Number(
    goal?.required_amount != null
      ? goal.required_amount
      : goalTargetAmount(goal, asOf)
  ) || 0;
  if (target > 0 && current >= target) return 'completed';

  if (isLiquidityGoal(goal) || !goal?.target_date) return 'pending';

  const targetDate = new Date(goal.target_date);
  if (Number.isNaN(targetDate.getTime())) return 'pending';

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  if (asOf.getTime() > endOfDay.getTime()) return 'not_yet';
  return 'pending';
}

/** Normalize API goal_year: null for common, integer year otherwise. */
export function parseGoalYear(value, { allowNull = true } = {}) {
  if (value === null || value === undefined || value === '' || value === 'common') {
    return allowNull ? null : undefined;
  }
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) {
    return undefined;
  }
  return Math.trunc(year);
}
