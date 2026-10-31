'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { GrowthAvatar, WaterBubbles, useCelebrateOnce } from '@/components/GrowthVisual';
import { inr, fmtDate, TYPE_META, toneFor, labelFor, frequencySuffix } from '@/lib/format';
import {
  effectiveInvestedSoFar,
  hasGrowthDeduction,
  isLiquiditySaving,
  isLumpSumInvestment,
  isMarketInvestment,
  isMetalInvestment,
  isChitInvestment,
  isRecurringFrequency,
  tenureProgress,
} from '@/lib/investments';
import {
  getLifecycleLabel,
  isActiveInvestment,
  isClosedInvestment,
  isClosedLifecycleStatus,
  isPrematureWithdrawalStatus,
  resolveLifecycleStatus,
} from '@/lib/investment-lifecycle';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

const CATEGORY_DEFS = [
  { key: 'LIQUIDITY', label: 'Liquidity' },
  { key: 'GOLD', label: 'Gold' },
  { key: 'SILVER', label: 'Silver' },
  { key: 'FD', label: 'Fixed Deposit' },
  { key: 'RD', label: 'Recurring Deposit' },
  { key: 'MF', label: 'Mutual Fund' },
  { key: 'ETF', label: 'ETF' },
  { key: 'ST', label: 'Shares' },
  { key: 'PPF', label: 'PPF' },
  { key: 'CHIT', label: 'Chit Fund' },
  { key: 'OT', label: 'Other' },
];

function categoryKey(investment) {
  if (isLiquiditySaving(investment)) return 'LIQUIDITY';
  if (investment.type_code === 'GOLD' || investment.type_code === 'GD') return 'GOLD';
  if (investment.type_code === 'SILV') return 'SILVER';
  return investment.type_code || 'OT';
}

function categoryLabel(key) {
  return CATEGORY_DEFS.find((item) => item.key === key)?.label || TYPE_META[key]?.label || key;
}

function LayoutToggle({ value, onChange }) {
  return (
    <div className="flex rounded-full border border-edge overflow-hidden text-[11px] flex-shrink-0">
      <button type="button" onClick={() => onChange('list')} className={`px-2.5 py-1 ${value === 'list' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>List</button>
      <button type="button" onClick={() => onChange('tiles')} className={`px-2.5 py-1 ${value === 'tiles' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>Tiles</button>
    </div>
  );
}

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

function growthKindFor(investment, { isClosedPlan, isPremature, progress, deducted }) {
  if (isLiquiditySaving(investment)) return 'savings';
  const recurring = isRecurringFrequency(investment.payment_frequency) || isChitInvestment(investment.type_code);
  if (isPremature) return recurring ? 'wilted' : 'bubbles';
  if (isClosedPlan || progress?.complete) return recurring ? 'complete' : 'achieved';
  if (recurring) return deducted ? 'wilted' : 'tree';
  if (isLumpSumInvestment(investment)) return 'achieved';
  return 'bubbles';
}

function InvestmentRow({ investment, idx, href }) {
  const tone = toneFor(investment.type_code);
  const marketType = isMarketInvestment(investment.type_code);
  const metalType = isMetalInvestment(investment.type_code);
  const chitType = isChitInvestment(investment.type_code);
  const lumpSum = isLumpSumInvestment(investment);
  const chitPl = Number(investment.chit_details?.summary?.profit_loss);
  const days = daysUntilMaturity(investment.maturity_date);
  const liquidity = isLiquiditySaving(investment);
  const isMatured = !liquidity && !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days <= 0;
  const isUrgent = !liquidity && !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days >= 0 && days <= 30;
  const isWarning = !liquidity && !marketType && !isClosedLifecycleStatus(investment.lifecycle_status) && days !== null && days >= 0 && days <= 90 && !isUrgent;
  const isPremature = isPrematureWithdrawalStatus(investment.lifecycle_status);
  const isClosedPlan = isClosedInvestment(investment);
  const lifecycleLabelText = getLifecycleLabel(resolveLifecycleStatus(investment));
  const progress = tenureProgress(investment);
  const investedSoFar = effectiveInvestedSoFar(investment);
  const deducted = hasGrowthDeduction(investment) || isPremature;
  const kind = growthKindFor(investment, { isClosedPlan, isPremature, progress, deducted });
  const celebrate = kind === 'complete' && !isPremature;
  const { hostRef, originRef } = useCelebrateOnce(`inv-${investment.id}`, celebrate);
  const avatarTone = lumpSum && !isClosedPlan && !isPremature ? 'mint' : tone;
  const showBubblesOnRow = kind === 'bubbles' || kind === 'achieved';
  const rowTone = isClosedPlan
    ? 'bg-paper-tint/80 opacity-90'
    : isPremature
      ? 'bg-danger-soft/30'
      : celebrate || isMatured
        ? 'bg-mint-50/60'
        : lumpSum && !marketType && !metalType
          ? 'bg-mint-50/40'
          : isUrgent
            ? 'bg-danger-soft/40'
            : isWarning
              ? 'bg-honey-50/60'
              : '';

  return (
    <div ref={hostRef} className={`growth-stage ${idx > 0 ? 'border-t border-edge' : ''} ${rowTone}`}>
      <Link
        href={href || `/investments/${investment.id}`}
        className="flex items-center gap-3 p-3.5 hover:bg-paper-tint/50 transition relative"
      >
        {showBubblesOnRow && !isClosedPlan ? <WaterBubbles count={4} tone={lumpSum ? 'mint' : metalType ? 'honey' : 'sky'} /> : null}
        <div ref={originRef} className="relative z-[1] flex-shrink-0">
          <GrowthAvatar
            kind={kind}
            ratio={progress ? progress.ratio : null}
            typeShort={TYPE_META[investment.type_code]?.short || 'OT'}
            typeCode={investment.type_code}
            customType={investment.custom_type}
            planName={investment.plan_name}
            toneClass={TONE_BG[avatarTone]}
            celebrate={celebrate}
          />
        </div>
      <div className="flex-1 min-w-0 relative z-[1]">
        <p className="text-sm font-medium truncate">
          {investment.bank} · {investment.plan_name}
          {liquidity && <span className="ml-1.5 align-middle text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-600/30 font-medium tracking-wide uppercase">Liquidity</span>}
        </p>
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
          ) : liquidity ? (
            <> · available</>
          ) : (
            <>
              {investment.tenure_months > 0 && <> · {investment.tenure_months >= 12 ? `${Math.round(investment.tenure_months / 12)} yr` : `${investment.tenure_months} mo`}</>}
              {progress && <> · {progress.label}</>}
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
      <div className="text-right flex-shrink-0 min-w-[5.5rem] relative z-[1]">
        <p className="text-sm font-medium">{inr(isClosedPlan && Number(investment.closure_amount) > 0 ? investment.closure_amount : investedSoFar)}</p>
        <p className="text-[11px] text-mint-700 mt-0.5">
          {isClosedPlan && Number(investment.closure_amount) > 0 ? 'received' : 'saved so far'}
          {progress && !liquidity ? ` · ${progress.label}` : ''}
        </p>
        {metalType && <p className="text-[10px] text-honey-600 mt-0.5">{formatUnits(investment.total_units)} g</p>}
        {marketType && <p className="text-[10px] text-sky-600 mt-0.5">{formatUnits(investment.total_units)} units</p>}
        {(chitType || isRecurringFrequency(investment.payment_frequency)) && !isClosedPlan && (
          <p className="text-[10px] text-ink-mute mt-0.5">{inr(investment.amount)}{chitType ? ' chit value' : frequencySuffix(investment.payment_frequency)}</p>
        )}
        {chitType && Number.isFinite(chitPl) && (
          <p className={`text-[10px] mt-0.5 ${chitPl < 0 ? 'text-danger' : 'text-mint-600'}`}>
            {chitPl >= 0 ? '+' : ''}{inr(chitPl)}{investment.chit_details?.pick_month ? ` · M${investment.chit_details.pick_month}` : ''}
          </p>
        )}
      </div>
      </Link>
    </div>
  );
}

function savedSoFar(investment) {
  const closedWithReceipt = isClosedInvestment(investment) && Number(investment.closure_amount) > 0;
  return {
    amount: closedWithReceipt ? Number(investment.closure_amount) : effectiveInvestedSoFar(investment),
    label: closedWithReceipt ? 'received' : 'saved so far',
  };
}

function InvestmentTile({ investment, href }) {
  const saved = savedSoFar(investment);
  const metalType = isMetalInvestment(investment.type_code);
  const marketType = isMarketInvestment(investment.type_code);
  const key = categoryKey(investment);
  const closed = isClosedInvestment(investment);

  return (
    <Link href={href} className="block bg-paper-card border border-edge rounded-2xl p-3.5 hover:border-mint-600 transition h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug min-w-0">{investment.bank} · {investment.plan_name}</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-paper-tint border border-edge text-ink-soft flex-shrink-0">{categoryLabel(key)}</span>
      </div>
      <p className="text-lg font-medium mt-3">{inr(saved.amount)}</p>
      <p className="text-[11px] text-mint-700">{saved.label}{closed ? ` · ${getLifecycleLabel(resolveLifecycleStatus(investment))}` : ''}</p>
      {(isChitInvestment(investment.type_code) || isRecurringFrequency(investment.payment_frequency)) && !closed && (
        <p className="text-[10px] text-ink-mute mt-1">{inr(investment.amount)}{isChitInvestment(investment.type_code) ? ' chit value' : frequencySuffix(investment.payment_frequency)}</p>
      )}
      {metalType && <p className="text-[10px] text-honey-600 mt-1">{formatUnits(investment.total_units)} g held</p>}
      {marketType && <p className="text-[10px] text-sky-600 mt-1">{formatUnits(investment.total_units)} units</p>}
    </Link>
  );
}

export default function InvestmentsClient({ user, initialInvestments = null, readOnly = false, linkBase = '/investments' }) {
  const seeded = Array.isArray(initialInvestments);
  const [investments, setInvestments] = useState(seeded ? initialInvestments : []);
  const [loading, setLoading] = useState(!seeded && !readOnly);
  const [filter, setFilter] = useState('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState('active');
  const [layout, setLayout] = useState('list');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'closed' || view === 'all' || view === 'active') {
      setLifecycleFilter(view);
    }
    const stored = window.localStorage.getItem('investments-layout');
    if (stored === 'tiles' || stored === 'list') setLayout(stored);
  }, []);

  const chooseLayout = (next) => {
    setLayout(next);
    window.localStorage.setItem('investments-layout', next);
  };

  useEffect(() => {
    if (readOnly && !seeded && process.env.NODE_ENV !== 'production') {
      console.warn('InvestmentsClient: pass initialInvestments when readOnly=true (view links have no auth for /api/investments).');
    }
  }, [readOnly, seeded]);

  useEffect(() => {
    if (seeded || readOnly) return undefined;
    fetch('/api/investments').then((r) => r.json()).then((d) => {
      setInvestments(d.investments || []);
      setLoading(false);
    });
    return undefined;
  }, [seeded, readOnly]);

  const activeInvestments = investments.filter(isActiveInvestment);
  const closedInvestments = investments.filter(isClosedInvestment);

  const lifecycleScoped = lifecycleFilter === 'active'
    ? activeInvestments
    : lifecycleFilter === 'closed'
      ? closedInvestments
      : investments;

  const categoryBuckets = new Map();
  investments.forEach((investment) => {
    const key = categoryKey(investment);
    if (!categoryBuckets.has(key)) categoryBuckets.set(key, []);
    categoryBuckets.get(key).push(investment);
  });
  const categories = [
    ...CATEGORY_DEFS.filter((item) => categoryBuckets.has(item.key)),
    ...Array.from(categoryBuckets.keys())
      .filter((key) => !CATEGORY_DEFS.some((item) => item.key === key))
      .map((key) => ({ key, label: categoryLabel(key) })),
  ].map((item) => {
    const plans = categoryBuckets.get(item.key) || [];
    return {
      ...item,
      count: plans.length,
      saved: plans.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0),
    };
  });

  const filtered = filter === 'ALL'
    ? lifecycleScoped
    : investments.filter((investment) => categoryKey(investment) === filter);
  const total = filtered.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0);
  const selectedCategory = categories.find((item) => item.key === filter);

  const nearMaturityCount = activeInvestments.filter((investment) => {
    if (isMarketInvestment(investment.type_code) || isLiquiditySaving(investment)) return false;
    const d = daysUntilMaturity(investment.maturity_date);
    return d !== null && d >= 0 && d <= 90;
  }).length;

  const maturedCount = activeInvestments.filter((investment) => {
    if (isMarketInvestment(investment.type_code) || isLiquiditySaving(investment)) return false;
    const d = daysUntilMaturity(investment.maturity_date);
    return d !== null && d <= 0;
  }).length;

  const prematureCount = closedInvestments.filter((investment) => isPrematureWithdrawalStatus(investment.lifecycle_status)).length;
  const closedCount = closedInvestments.length;

  const lifecycleLabel = lifecycleFilter === 'active' ? 'Active' : lifecycleFilter === 'closed' ? 'Closed' : 'All';

  const content = (
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-4xl mx-auto w-full">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Investments</h1>
            <p className="text-sm text-ink-soft mt-1">
              {filter === 'ALL' ? (
                <>{filtered.length} {lifecycleLabel.toLowerCase()} {filtered.length === 1 ? 'plan' : 'plans'} · saved so far <span className="font-medium text-ink">{inr(total)}</span></>
              ) : (
                <>{selectedCategory?.label || 'Category'} · {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} · saved so far <span className="font-medium text-ink">{inr(total)}</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LayoutToggle value={layout} onChange={chooseLayout} />
            {!readOnly && <Link href="/investments/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium whitespace-nowrap">+ Add</Link>}
          </div>
        </div>

        {!loading && investments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => { setLifecycleFilter('active'); setFilter('ALL'); }} className={`chip whitespace-nowrap ${filter === 'ALL' && lifecycleFilter === 'active' ? 'on' : ''}`}>Active ({activeInvestments.length})</button>
            <button onClick={() => { setLifecycleFilter('closed'); setFilter('ALL'); }} className={`chip whitespace-nowrap ${filter === 'ALL' && lifecycleFilter === 'closed' ? 'on' : ''}`}>Closed ({closedCount})</button>
            <button onClick={() => { setLifecycleFilter('all'); setFilter('ALL'); }} className={`chip whitespace-nowrap ${filter === 'ALL' && lifecycleFilter === 'all' ? 'on' : ''}`}>All ({investments.length})</button>
          </div>
        )}

        {!loading && lifecycleFilter === 'active' && closedCount > 0 && (
          <div className="flex items-start gap-3 bg-paper-tint border border-edge rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">📁</span>
            <p className="text-sm text-ink-soft"><span className="font-medium text-ink">{closedCount} closed plan{closedCount > 1 ? 's' : ''}</span> — premature, matured, or redeemed. <button type="button" onClick={() => setLifecycleFilter('closed')} className="text-sky-600 hover:underline">View closed</button></p>
          </div>
        )}

        {!loading && lifecycleFilter === 'closed' && closedCount === 0 && (
          <div className="text-center py-10 mb-4 border border-dashed border-edge rounded-xl">
            <p className="text-sm font-medium">No closed investments yet</p>
            <p className="text-sm text-ink-soft mt-1">Premature, matured, or redeemed plans will appear here.</p>
          </div>
        )}

        {!loading && prematureCount > 0 && lifecycleFilter !== 'active' && (
          <div className="flex items-start gap-3 bg-danger-soft border border-danger/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">⚠️</span>
            <p className="text-sm text-danger"><span className="font-medium">{prematureCount} investment{prematureCount > 1 ? 's were' : ' was'} prematurely withdrawn.</span> {readOnly ? 'Closure amounts are shown with each plan.' : 'Review closure amounts and update records if needed.'}</p>
          </div>
        )}

        {!loading && nearMaturityCount > 0 && lifecycleFilter === 'active' && (
          <div className="flex items-start gap-3 bg-honey-50 border border-honey-600/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">📅</span>
            <p className="text-sm text-honey-600"><span className="font-medium">{nearMaturityCount} investment{nearMaturityCount > 1 ? 's' : ''} maturing within 90 days.</span> {readOnly ? 'Open a plan to see the maturity date.' : 'Tap to review and decide: renew, withdraw, or reinvest.'}</p>
          </div>
        )}

        {!loading && maturedCount > 0 && lifecycleFilter === 'active' && (
          <div className="flex items-start gap-3 bg-mint-50 border border-mint-600/30 rounded-xl p-3.5 mb-4">
            <span className="text-xl leading-none">✅</span>
            <p className="text-sm text-mint-700"><span className="font-medium">{maturedCount} investment{maturedCount > 1 ? 's are' : ' is'} matured.</span> {readOnly ? 'Open a plan to see the recorded outcome.' : 'Review closure, withdrawal, or reinvestment action.'}</p>
          </div>
        )}

        {investments.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
            <button onClick={() => setFilter('ALL')} className={`chip whitespace-nowrap ${filter === 'ALL' ? 'on' : ''}`}>
              <span className="block leading-tight">All</span>
              <span className="block text-[10px] font-medium leading-tight mt-0.5">{inr(lifecycleScoped.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0))}</span>
            </button>
            {categories.map((category) => (
              <button key={category.key} onClick={() => setFilter(category.key)} className={`chip whitespace-nowrap ${filter === category.key ? 'on' : ''}`}>
                <span className="block leading-tight">{category.label} ({category.count})</span>
                <span className="block text-[10px] font-medium leading-tight mt-0.5">{inr(category.saved)} saved</span>
              </button>
            ))}
          </div>
        )}

        {!loading && selectedCategory && (
          <div className="mb-4 rounded-2xl border border-edge bg-paper-card px-4 py-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-mute">{selectedCategory.label}</p>
              <p className="text-2xl font-medium">{inr(selectedCategory.saved)}</p>
            </div>
            <p className="text-xs text-ink-soft text-right">saved so far · {selectedCategory.count} {selectedCategory.count === 1 ? 'plan' : 'plans'}</p>
          </div>
        )}

        {loading && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-paper-tint rounded-xl animate-pulse" />)}</div>}

        {!loading && investments.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-1">No investments yet</p>
            <p className="text-sm text-ink-soft mb-5">{readOnly ? 'This portfolio has no investments yet.' : 'Add your first FD, RD, chit fund, mutual fund, or other investment.'}</p>
            {!readOnly && <Link href="/investments/new" className="btn-primary py-2.5 px-5 rounded-lg text-sm font-medium inline-block">Add an investment</Link>}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          layout === 'tiles' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((investment) => (
                <InvestmentTile
                  key={investment.id}
                  investment={investment}
                  href={readOnly ? `${linkBase}/investments/${investment.id}` : `/investments/${investment.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
              {filtered.map((investment, idx) => (
                <InvestmentRow
                  key={investment.id}
                  investment={investment}
                  idx={idx}
                  href={readOnly ? `${linkBase}/investments/${investment.id}` : `/investments/${investment.id}`}
                />
              ))}
            </div>
          )
        )}
      </div>
  );

  if (readOnly) return content;
  return <Shell user={user}>{content}</Shell>;
}
