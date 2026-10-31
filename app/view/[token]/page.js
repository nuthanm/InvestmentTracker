import { unstable_noStore as noStore } from 'next/cache';
import ViewShell from '@/components/ViewShell';
import { getViewAccess, loadViewPortfolio, viewLinkIsActive } from '@/lib/view-access';
import InvestmentsClient from '@/app/investments/InvestmentsClient';
import ViewUnlockClient from './ViewUnlockClient';
import { inr, fmtDate } from '@/lib/format';
import { effectiveInvestedSoFar, isMetalInvestment } from '@/lib/investments';
import { goalTargetAmount, isLiquidityGoal } from '@/lib/goals';
import { isActiveInvestment } from '@/lib/investment-lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function investedTowardGoal(goalId, investments) {
  return investments.reduce((sum, investment) => {
    if (String(investment.goal_id || '') !== String(goalId)) return sum;
    if (!isActiveInvestment(investment) && !isMetalInvestment(investment.type_code)) return sum;
    return sum + effectiveInvestedSoFar(investment);
  }, 0);
}

function InactiveView() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-paper-card border border-edge rounded-2xl p-7 text-center">
        <div className="brand-mark w-12 h-12 rounded-2xl bg-ink text-paper flex items-center justify-center text-xl font-medium mx-auto mb-4">₹</div>
        <h1 className="text-xl font-medium">This view link is not active</h1>
        <p className="text-sm text-ink-soft mt-2">
          The owner may have replaced or revoked it. Ask them for a new link and password.
        </p>
      </div>
    </div>
  );
}

export default async function ViewPortfolioPage({ params }) {
  noStore();
  const active = await viewLinkIsActive(params.token);
  if (!active) return <InactiveView />;

  const access = await getViewAccess(params.token);
  if (!access) return <ViewUnlockClient token={params.token} />;

  const portfolio = await loadViewPortfolio(access.userId);
  const expiresLabel = new Date(access.expiresAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <ViewShell token={params.token} ownerName={portfolio.ownerName}>
      <div className="px-4 md:px-8 pt-5 max-w-4xl mx-auto w-full">
        <div className="rounded-xl border border-edge bg-paper-tint px-4 py-3 mb-4">
          <p className="text-sm font-medium">View only</p>
          <p className="text-xs text-ink-soft mt-1">
            You can see the same investments and goals. Adding, editing, deleting, payments, and export stay off.
            This view closes on this device after {expiresLabel}.
          </p>
        </div>

        {portfolio.goals.length > 0 && (
          <section className="mb-2">
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Goals</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {portfolio.goals.map((goal) => {
                const invested = investedTowardGoal(goal.id, portfolio.investments);
                return (
                  <div key={goal.id} className="bg-paper-card border border-edge rounded-xl px-3.5 py-3">
                    <p className="text-sm font-medium">{goal.name}</p>
                    {goal.description ? <p className="text-[11px] text-ink-soft mt-1 line-clamp-2">{goal.description}</p> : null}
                    <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <p className="text-[10px] tracking-wider uppercase text-ink-mute">{isLiquidityGoal(goal) ? 'Keep available' : 'Target'}</p>
                        <p className="text-base font-medium leading-snug">{inr(goalTargetAmount(goal))}</p>
                      </div>
                      <p className="shrink-0 text-[11px] text-ink-soft pb-0.5">
                        {isLiquidityGoal(goal)
                          ? (Number(goal.inflation_pct) > 0 ? `${Number(goal.inflation_pct)}% inflation` : 'No end date')
                          : `By ${fmtDate(goal.target_date)}`}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-dashed border-edge">
                      <p className="text-[10px] tracking-wider uppercase text-ink-mute">Invested</p>
                      <p className="text-sm font-medium text-mint-700">{inr(invested)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <InvestmentsClient
        readOnly
        linkBase={`/view/${params.token}`}
        initialInvestments={portfolio.investments}
      />
    </ViewShell>
  );
}
