'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, TYPE_META, toneFor, labelFor, frequencySuffix } from '@/lib/format';
import { effectiveInvestedSoFar, isMarketInvestment, isMetalInvestment } from '@/lib/investments';
import {
  getLifecycleLabel,
  isActiveInvestment,
  isClosedInvestment,
  isClosedLifecycleStatus,
  isPrematureWithdrawalStatus,
  resolveLifecycleStatus,
} from '@/lib/investment-lifecycle';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

function daysUntilMaturity(maturityDate) {
  if (!maturityDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mat = new Date(maturityDate);
  mat.setHours(0, 0, 0, 0);
  return Math.round((mat - today) / (1000 * 60 * 60 * 24));
}

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

export default function InvestmentsClient({ user }) {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState('active');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'closed' || view === 'all' || view === 'active') {
      setLifecycleFilter(view);
    }
  }, []);

  useEffect(() => {
    fetch('/api/investments').then((r) => r.json()).then((d) => {
      setInvestments(d.investments || []);
      setLoading(false);
    });
  }, []);

  const activeInvestments = investments.filter(isActiveInvestment);
  const closedInvestments = investments.filter(isClosedInvestment);

  const lifecycleScoped = lifecycleFilter === 'active'
    ? activeInvestments
    : lifecycleFilter === 'closed'
      ? closedInvestments
      : investments;

  const filtered = filter === 'ALL'
    ? lifecycleScoped
    : lifecycleScoped.filter((investment) => investment.type_code === filter);
  const total = filtered.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0);
  const types = Array.from(new Set(lifecycleScoped.map((investment) => investment.type_code)));

  const nearMaturityCount = activeInvestments.filter((investment) => {
    if (isMarketInvestment(investment.type_code)) return false;
    const d = daysUntilMaturity(investment.maturity_date);
    return d !== null && d >= 0 && d <= 90;
  }).length;

  const maturedCount = activeInvestments.filter((investment) => {
    if (isMarketInvestment(investment.type_code)) return false;
    const d = daysUntilMaturity(investment.maturity_date);
    return d !== null && d <= 0;
  }).length;

  const prematureCount = closedInvestments.filter((investment) => isPrematureWithdrawalStatus(investment.lifecycle_status)).length;
  const closedCount = closedInvestments.length;

  const lifecycleLabel = lifecycleFilter === 'active' ? 'Active' : lifecycleFilter === 'closed' ? 'Closed' : 'All';

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-4xl mx-auto w-full">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Investments</h1>
            <p className="text-sm text-ink-soft mt-1">{filtered.length} {lifecycleLabel.toLowerCase()} {filtered.length === 1 ? 'plan' : 'plans'} · {inr(total)} invested</p>
          </div>
          <Link href="/investments/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0">+ Add</Link>
        </div>

        {!loading && investments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setLifecycleFilter('active')} className={`chip whitespace-nowrap ${lifecycleFilter === 'active' ? 'on' : ''}`}>Active ({activeInvestments.length})</button>
            <button onClick={() => setLifecycleFilter('closed')} className={`chip whitespace-nowrap ${lifecycleFilter === 'closed' ? 'on' : ''}`}>Closed ({closedCount})</button>
            <button onClick={() => setLifecycleFilter('all')} className={`chip whitespace-nowrap ${lifecycleFilter === 'all' ? 'on' : ''}`}>All ({investments.length})</button>
          </div>
        )}

        {!loading && lifecycleFilter === 'active' && closedCount > 0 && (
          <div className="flex items-start gap-3 bg-paper-tint border border-edge rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">📁</span>
            <p className="text-sm text-ink-soft"><span className="font-medium text-ink">{closedCount} closed plan{closedCount > 1 ? 's' : ''}</span> — premature, matured, or redeemed. <button type="button" onClick={() => setLifecycleFilter('closed')} className="text-sky-600 hover:underline">View closed</button></p>
          </div>
        )}

        {!loading && lifecycleFilter === 'closed' && closedCount === 0 && (
          <div className="text-center py-10 mb-4 border border-dashed border-edge rounded-2xl">
            <p className="text-sm font-medium">No closed investments yet</p>
            <p className="text-sm text-ink-soft mt-1">Premature, matured, or redeemed plans will appear here.</p>
          </div>
        )}

        {!loading && prematureCount > 0 && lifecycleFilter !== 'active' && (
          <div className="flex items-start gap-3 bg-danger-soft border border-danger/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">⚠️</span>
            <p className="text-sm text-danger"><span className="font-medium">{prematureCount} investment{prematureCount > 1 ? 's were' : ' was'} prematurely withdrawn.</span> Review closure amounts and update records if needed.</p>
          </div>
        )}

        {!loading && nearMaturityCount > 0 && lifecycleFilter === 'active' && (
          <div className="flex items-start gap-3 bg-honey-50 border border-honey-600/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">📅</span>
            <p className="text-sm text-honey-600"><span className="font-medium">{nearMaturityCount} investment{nearMaturityCount > 1 ? 's' : ''} maturing within 90 days.</span> Tap to review and decide: renew, withdraw, or reinvest.</p>
          </div>
        )}

        {!loading && maturedCount > 0 && lifecycleFilter === 'active' && (
          <div className="flex items-start gap-3 bg-mint-50 border border-mint-600/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">✅</span>
            <p className="text-sm text-mint-700"><span className="font-medium">{maturedCount} investment{maturedCount > 1 ? 's are' : ' is'} matured.</span> Review closure, withdrawal, or reinvestment action.</p>
          </div>
        )}

        {investments.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
            <button onClick={() => setFilter('ALL')} className={`chip whitespace-nowrap ${filter === 'ALL' ? 'on' : ''}`}>All</button>
            {types.map((t) => <button key={t} onClick={() => setFilter(t)} className={`chip whitespace-nowrap ${filter === t ? 'on' : ''}`}>{TYPE_META[t]?.label || t}</button>)}
          </div>
        )}

        {loading && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-paper-tint rounded-xl animate-pulse" />)}</div>}

        {!loading && investments.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-1">No investments yet</p>
            <p className="text-sm text-ink-soft mb-5">Add your first FD, RD, mutual fund, ETF, share, or other investment.</p>
            <Link href="/investments/new" className="btn-primary py-2.5 px-5 rounded-lg text-sm font-medium inline-block">Add an investment</Link>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
            {filtered.map((investment, idx) => {
              const tone = toneFor(investment.type_code);
              const marketType = isMarketInvestment(investment.type_code);
              const metalType = isMetalInvestment(investment.type_code);
              const suffix = frequencySuffix(investment.payment_frequency);
              const days = daysUntilMaturity(investment.maturity_date);
              const isMatured = !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days <= 0;
              const isUrgent = !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days >= 0 && days <= 30;
              const isWarning = !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days >= 0 && days <= 90 && !isUrgent;
              const isPremature = isPrematureWithdrawalStatus(investment.lifecycle_status);
              const isClosedPlan = isClosedInvestment(investment);
              const lifecycleLabelText = getLifecycleLabel(resolveLifecycleStatus(investment));
              return (
                <Link key={investment.id} href={`/investments/${investment.id}`} className={`flex items-center gap-3 p-3.5 hover:bg-paper-tint/50 transition ${idx > 0 ? 'border-t border-edge' : ''} ${isClosedPlan ? 'bg-paper-tint/80 opacity-90' : isPremature ? 'bg-danger-soft/30' : isMatured ? 'bg-mint-50/60' : isUrgent ? 'bg-danger-soft/40' : isWarning ? 'bg-honey-50/60' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 ${TONE_BG[tone]}`}>{TYPE_META[investment.type_code]?.short || 'OT'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{investment.bank} · {investment.plan_name}</p>
                    <p className="text-[11px] text-ink-mute mt-0.5 truncate">
                      {isClosedPlan && <span className="text-ink-soft font-medium">{lifecycleLabelText} · </span>}
                      {labelFor(investment)}
                      {marketType ? (
                        <>
                          {' '}· {formatUnits(investment.total_units)} units
                          {investment.is_closed && <> · closed</>}
                          {isPrematureWithdrawalStatus(investment.lifecycle_status) && <> · premature withdrawal</>}
                          {investment.lifecycle_status === 'closed' && <> · closed</>}
                          {investment.lifecycle_status === 'matured' && <> · matured</>}
                        </>
                      ) : metalType ? (
                        <>
                          {' '}· {formatUnits(investment.total_units)} g held
                          {isPrematureWithdrawalStatus(investment.lifecycle_status) && <> · premature withdrawal</>}
                          {investment.lifecycle_status === 'closed' && <> · closed</>}
                          {investment.account_holder && investment.account_holder !== 'Self' && <> · {investment.account_holder}</>}
                        </>
                      ) : (
                        <>
                          {investment.tenure_months > 0 && <> · {investment.tenure_months >= 12 ? `${Math.round(investment.tenure_months / 12)} yr` : `${investment.tenure_months} mo`}</>}
                          {investment.maturity_date && <> · matures {fmtDate(investment.maturity_date)}</>}
                          {isPrematureWithdrawalStatus(investment.lifecycle_status) && <> · premature withdrawal</>}
                          {investment.lifecycle_status === 'closed' && <> · closed</>}
                          {investment.lifecycle_status === 'matured' && <> · matured</>}
                          {investment.auto_renew && <> · auto-renew</>}
                        </>
                      )}
                      {!metalType && investment.account_holder && investment.account_holder !== 'Self' && <> · {investment.account_holder}</>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[5rem]">
                    {marketType ? (
                      <>
                        <p className="text-sm font-medium">{inr(investment.remaining_cost_basis || 0)}</p>
                        <p className="text-[11px] text-sky-600 mt-0.5">{inr(investment.invested_amount || 0)} invested</p>
                      </>
                    ) : metalType ? (
                      <>
                        <p className="text-sm font-medium">{formatUnits(investment.total_units)} g</p>
                        <p className="text-[11px] text-honey-600 mt-0.5">{inr(investment.remaining_cost_basis || 0)} cost</p>
                      </>
                    ) : (
                      <>
                        {isClosedPlan ? (
                          <>
                            <p className="text-sm font-medium">{inr(Number(investment.closure_amount) > 0 ? investment.closure_amount : (investment.maturity_value || investment.amount))}</p>
                            <p className="text-[11px] text-ink-soft mt-0.5">{Number(investment.closure_amount) > 0 ? 'received' : 'maturity value'}{investment.closure_date ? ` · ${fmtDate(investment.closure_date)}` : ''}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium">{inr(investment.amount)}{suffix && <span className="text-[11px] text-ink-soft font-normal">{suffix}</span>}</p>
                            <p className="text-[11px] text-mint-600 mt-0.5">{investment.rate_pct}% p.a.</p>
                            {isMatured && <p className="text-[10px] text-mint-700 font-medium mt-0.5">✅ {days === 0 ? 'today' : `${Math.abs(days)}d ago`}</p>}
                            {isUrgent && <p className="text-[10px] text-danger font-medium mt-0.5">⚠ {days}d left</p>}
                            {isWarning && <p className="text-[10px] text-honey-600 font-medium mt-0.5">📅 {days}d left</p>}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
