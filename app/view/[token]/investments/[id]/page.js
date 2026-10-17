import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ViewShell from '@/components/ViewShell';
import { getViewAccess, loadViewInvestment } from '@/lib/view-access';
import { inr, fmtDate, labelFor, frequencyLabel, frequencySuffix } from '@/lib/format';
import {
  buildRecurringPaymentSchedule,
  computeTransactionNetAmount,
  getTransactionTypeLabel,
  isChitInvestment,
  isMarketInvestment,
  isMetalInvestment,
  tenureProgress,
} from '@/lib/investments';
import { getLifecycleLabel, isClosedLifecycleStatus, isPrematureWithdrawalStatus } from '@/lib/investment-lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-dashed border-edge text-sm gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function dueLabel(date) {
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1 && diff <= 30) return `Due in ${diff} days`;
  if (diff < 0) return `Overdue by ${Math.abs(diff)} days`;
  return fmtDate(date);
}

export default async function ViewInvestmentPage({ params }) {
  const access = await getViewAccess(params.token);
  if (!access) redirect(`/view/${params.token}`);

  const detail = await loadViewInvestment(access.userId, params.id);
  if (!detail) notFound();

  const investment = detail.investment;
  const marketType = isMarketInvestment(investment.type_code);
  const metalType = isMetalInvestment(investment.type_code);
  const chitType = isChitInvestment(investment.type_code);
  const transactionType = marketType || metalType;
  const frequency = investment.payment_frequency;
  const recurring = !transactionType && (frequency === 'monthly' || frequency === 'yearly');
  const suffix = chitType ? '' : frequencySuffix(frequency);
  const monthlyPct = (Number(investment.rate_pct) / 12).toFixed(3);
  const monthlyInterest = (Number(investment.amount) * Number(investment.rate_pct)) / 100 / 12;
  const chitSummary = chitType ? investment.chit_details?.summary : null;
  const schedule = recurring ? buildRecurringPaymentSchedule(investment) : [];
  const paymentsByPeriod = new Map(detail.payments.map((payment) => [String(payment.period_label), payment]));
  const paidCount = detail.payments.filter((payment) => payment.paid).length;
  const totalPaid = detail.payments.reduce((sum, payment) => sum + (payment.paid ? Number(payment.amount || 0) : 0), 0);
  const withdrawals = detail.withdrawals || [];
  const withdrawnTotal = withdrawals.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const stillInvested = Math.max(0, totalPaid - withdrawnTotal);
  const scheduleTotal = schedule.reduce((sum, slot) => sum + Number(slot.amount || 0), 0);
  const progress = tenureProgress(investment);
  const closed = isClosedLifecycleStatus(investment.lifecycle_status);

  return (
    <ViewShell token={params.token} ownerName={access.ownerName}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full">
        <Link href={`/view/${params.token}`} className="text-xs text-ink-soft mb-4 inline-block">← Back to portfolio</Link>

        <div className="rounded-xl border border-edge bg-paper-tint px-4 py-3 mb-4">
          <p className="text-sm font-medium">View only</p>
          <p className="text-xs text-ink-soft mt-1">These details match the owner’s record. Changes are turned off.</p>
        </div>

        {closed && (
          <div className={`rounded-xl p-3.5 mb-4 ${isPrematureWithdrawalStatus(investment.lifecycle_status) ? 'bg-danger-soft border border-danger/30' : 'bg-mint-50 border border-mint-600/30'}`}>
            <p className={`text-sm font-medium ${isPrematureWithdrawalStatus(investment.lifecycle_status) ? 'text-danger' : 'text-mint-700'}`}>
              {getLifecycleLabel(investment.lifecycle_status)}{investment.closure_date ? ` · ${fmtDate(investment.closure_date)}` : ''}
            </p>
            {investment.closure_amount != null && (
              <p className="text-[11px] text-ink-soft mt-0.5">
                Received {inr(investment.closure_amount)}
                {investment.penalty_amount ? ` · penalty ${inr(investment.penalty_amount)}` : ''}
                {investment.interest_loss ? ` · interest loss ${inr(investment.interest_loss)}` : ''}
              </p>
            )}
          </div>
        )}

        <div className="bg-paper-tint rounded-2xl p-5 mb-5">
          <p className="text-[11px] tracking-wider text-ink-mute uppercase">{labelFor(investment)}</p>
          {marketType ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(investment.remaining_cost_basis || 0)}</p>
              <p className="text-sm text-ink-soft mt-1">{formatUnits(investment.total_units)} units held</p>
              <p className="text-sm text-ink-soft mt-1">Invested {inr(investment.invested_amount || 0)} · Redeemed {inr(investment.redeemed_amount || 0)}</p>
            </>
          ) : metalType ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{formatUnits(investment.total_units)} g</p>
              <p className="text-sm text-ink-soft mt-1">Cost basis {inr(investment.remaining_cost_basis || 0)}</p>
            </>
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">
                {inr(investment.amount)}{suffix && <span className="text-base text-ink-soft font-normal">{suffix}</span>}
              </p>
              {recurring ? (
                <p className="text-sm text-ink-soft mt-1">
                  Still invested {inr(stillInvested)} / {inr(scheduleTotal || investment.amount)}
                  {schedule.length > 0 && ` · ${paidCount}/${schedule.length} paid`}
                  {withdrawnTotal > 0 && ` · withdrawn ${inr(withdrawnTotal)}`}
                </p>
              ) : null}
              <p className="text-sm text-ink-soft mt-1">
                {chitType ? 'Prize' : 'Matures to'} {inr(investment.maturity_value || investment.amount)}
                {investment.maturity_date ? ` · ${fmtDate(investment.maturity_date)}` : ''}
              </p>
            </>
          )}
          {progress ? <p className="text-xs text-ink-mute mt-2">{progress.label}</p> : null}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 mb-5">
          <Row label={metalType ? 'Store / source' : 'Bank / platform'} value={investment.bank} />
          <Row label={metalType ? 'Item description' : 'Plan'} value={investment.plan_name} />
          {!transactionType && <Row label={recurring ? 'Contribution' : 'Amount'} value={`${inr(investment.amount)}${suffix}`} />}
          {chitSummary && (
            <>
              <Row label="Pick month" value={`Month ${chitSummary.pick_month}`} />
              <Row label="Prize received" value={inr(chitSummary.prize)} />
              <Row label="Profit / loss" value={`${Number(chitSummary.profit_loss) >= 0 ? '+' : ''}${inr(chitSummary.profit_loss)}`} />
            </>
          )}
          {!transactionType && !chitType && <Row label="Rate" value={`${investment.rate_pct}% p.a. (≈ ${monthlyPct}%/mo)`} />}
          {!transactionType && !recurring && <Row label="Monthly interest" value={inr(monthlyInterest)} />}
          {!transactionType && <Row label="Payment frequency" value={frequencyLabel(frequency)} />}
          {!transactionType && (
            <Row
              label="Tenure"
              value={`${investment.tenure_months} months${investment.tenure_days ? ` ${investment.tenure_days} days` : ''}`}
            />
          )}
          {marketType && <Row label="Units held" value={formatUnits(investment.total_units)} />}
          {marketType && <Row label="Average buy price" value={inr(investment.average_buy_price || 0)} />}
          {marketType && <Row label="Invested amount" value={inr(investment.invested_amount || 0)} />}
          {marketType && <Row label="Redeemed amount" value={inr(investment.redeemed_amount || 0)} />}
          {marketType && <Row label="Realized gain / loss" value={inr(investment.realized_gain_loss || 0)} />}
          {metalType && <Row label="Weight held" value={`${formatUnits(investment.total_units)} g`} />}
          {metalType && <Row label="Avg purchase price" value={`${inr(investment.average_buy_price || 0)} / g`} />}
          <Row label="Started" value={fmtDate(investment.start_date)} />
          <Row label="Goal" value={investment.goal_name || '—'} />
          <Row label="Nominee" value={investment.nominee || '—'} />
          <Row label="Account holder" value={investment.account_holder || 'Self'} />
          {!transactionType && <Row label="Auto-renew" value={investment.auto_renew ? 'On' : 'Off'} />}
          <Row label="Lifecycle" value={getLifecycleLabel(investment.lifecycle_status || 'active')} />
          {investment.closure_notes ? <Row label="Closure notes" value={investment.closure_notes} /> : null}
          {detail.documentCount > 0 && (
            <Row label="Documents" value={`${detail.documentCount} on file`} />
          )}
        </div>

        {transactionType && (
          <section className="mb-5">
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Transaction history</p>
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
              {detail.transactions.length === 0 ? (
                <div className="px-4 py-6 text-sm text-ink-soft text-center">No transactions recorded.</div>
              ) : detail.transactions.map((tx, idx) => (
                <div key={tx.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-edge' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{getTransactionTypeLabel(tx.transaction_type)}</p>
                      <p className="text-[11px] text-ink-mute mt-0.5">
                        {fmtDate(tx.trade_date)}
                        {Number(tx.units || 0) > 0 && ` · ${formatUnits(tx.units)} ${metalType ? 'g' : 'units'}`}
                        {Number(tx.price_per_unit || 0) > 0 && ` · ${inr(tx.price_per_unit)} ${metalType ? '/ g' : '/ unit'}`}
                      </p>
                      {tx.notes ? <p className="text-[11px] text-ink-soft mt-1">{tx.notes}</p> : null}
                    </div>
                    <p className="text-sm font-medium">{inr(computeTransactionNetAmount(tx))}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recurring && (
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Payment history</p>
              <span className="text-[11px] text-ink-soft">{paidCount}/{schedule.length} paid · {inr(totalPaid)}</span>
            </div>
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
              {schedule.length === 0 ? (
                <div className="px-4 py-6 text-sm text-ink-soft text-center">No payment schedule.</div>
              ) : schedule.map((slot, idx) => {
                const record = paymentsByPeriod.get(String(slot.period_label));
                const paid = !!record?.paid;
                return (
                  <div key={slot.period_label} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx > 0 ? 'border-t border-edge' : ''}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] ${paid ? 'bg-mint-600 border-mint-600 text-white' : 'border-edge text-transparent'}`}>✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{slot.period_label}</p>
                      <p className="text-[11px] text-ink-mute">{paid ? `Paid ${fmtDate(record.paid_at || record.due_date)}` : dueLabel(slot.due_date)}</p>
                      {record?.notes ? <p className="text-[11px] text-ink-soft mt-0.5">{record.notes}</p> : null}
                    </div>
                    <p className="text-sm font-medium">{inr(slot.amount)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recurring && withdrawals.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Partial withdrawals</p>
              <span className="text-[11px] text-ink-soft">{inr(stillInvested)} still invested</span>
            </div>
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
              {withdrawals.map((row, idx) => (
                <div key={row.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx > 0 ? 'border-t border-edge' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{fmtDate(row.withdrawn_on)}</p>
                    {row.notes ? <p className="text-[11px] text-ink-soft mt-0.5">{row.notes}</p> : null}
                  </div>
                  <p className="text-sm font-medium">− {inr(row.amount)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ViewShell>
  );
}
