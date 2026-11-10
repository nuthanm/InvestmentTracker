'use client';

import Link from 'next/link';
import { Children, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { GrowthAvatar, WaterBubbles, useCelebrateOnce } from '@/components/GrowthVisual';
import { inr, inrShort, fmtDate, TYPE_META, toneFor, labelFor, frequencySuffix } from '@/lib/format';
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
import { groupInvestmentsByTag, hasTag, summarizeTags, tagKey } from '@/lib/tags';
import TagList from '@/components/TagList';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

const CATEGORY_DEFS = [
  { key: 'LIQUIDITY', label: 'Liquidity', short: 'Liquidity' },
  { key: 'GOLD', label: 'Gold', short: 'Gold' },
  { key: 'SILVER', label: 'Silver', short: 'Silver' },
  { key: 'FD', label: 'Fixed Deposit', short: 'FD' },
  { key: 'RD', label: 'Recurring Deposit', short: 'RD' },
  { key: 'MF', label: 'Mutual Fund', short: 'MF' },
  { key: 'ETF', label: 'ETF', short: 'ETF' },
  { key: 'ST', label: 'Shares', short: 'Shares' },
  { key: 'PPF', label: 'PPF', short: 'PPF' },
  { key: 'CHIT', label: 'Chit Fund', short: 'Chit' },
  { key: 'OT', label: 'Other', short: 'Other' },
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

function DragHandle({ onDragStart }) {
  if (!onDragStart) return null;
  return (
    <button
      type="button"
      draggable
      aria-label="Drag to change priority"
      title="Drag to change priority"
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(e);
      }}
      className="cursor-grab active:cursor-grabbing text-ink-mute hover:text-ink px-1.5 text-sm leading-none flex-shrink-0"
    >
      ⋮⋮
    </button>
  );
}

function moveVisible(all, visible, fromId, toId) {
  const nextVisible = visible.slice();
  const from = nextVisible.findIndex((item) => item.id === fromId);
  const to = nextVisible.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return all;
  const [item] = nextVisible.splice(from, 1);
  nextVisible.splice(to, 0, item);
  const visibleIds = new Set(visible.map((entry) => entry.id));
  let index = 0;
  return all.map((entry) => (visibleIds.has(entry.id) ? nextVisible[index++] : entry));
}

function LayoutToggle({ value, onChange }) {
  return (
    <div className="flex rounded-full border border-edge overflow-hidden text-[11px] flex-shrink-0">
      <button type="button" onClick={() => onChange('list')} className={`px-2.5 py-1 ${value === 'list' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>List</button>
      <button type="button" onClick={() => onChange('tiles')} className={`px-2.5 py-1 ${value === 'tiles' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>Tiles</button>
    </div>
  );
}

/** Horizontally scrolling filter row — stays one line on mobile. */
function FilterRail({ label, action = null, children }) {
  const railRef = useRef(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;

    const updateOverflow = () => {
      const max = el.scrollWidth - el.clientWidth;
      setOverflow({
        left: el.scrollLeft > 2,
        right: max > 2 && el.scrollLeft < max - 2,
      });
    };

    updateOverflow();
    el.addEventListener('scroll', updateOverflow, { passive: true });
    window.addEventListener('resize', updateOverflow);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateOverflow);
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
      resizeObserver?.disconnect();
    };
  }, [Children.count(children)]);

  const scrollByDir = (dir) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(180, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <p className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</p>
        {action}
      </div>
      <div className={`filter-rail-wrap${overflow.left ? ' has-left' : ''}${overflow.right ? ' has-right' : ''}`}>
        {overflow.left && (
          <div className="filter-rail-nav filter-rail-nav-left">
            <button
              type="button"
              className="filter-rail-nav-btn"
              onClick={() => scrollByDir(-1)}
              aria-label={`Scroll ${label} filters left`}
            >
              ‹
            </button>
          </div>
        )}
        <div ref={railRef} className="filter-rail">{children}</div>
        {overflow.right && (
          <div className="filter-rail-nav filter-rail-nav-right">
            <button
              type="button"
              className="filter-rail-nav-btn"
              onClick={() => scrollByDir(1)}
              aria-label={`Scroll ${label} filters right`}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, title, name, count = null, amount = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`filter-chip ${active ? 'on' : ''}`}
    >
      <span className="filter-chip-name">{name}</span>
      {count != null && <span className="filter-chip-count">{count}</span>}
      {amount != null && <span className="filter-chip-amount">{amount}</span>}
    </button>
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

function planDateLine(investment) {
  const start = investment.start_date ? fmtDate(investment.start_date) : null;
  const maturity = investment.maturity_date ? fmtDate(investment.maturity_date) : null;
  if (isLiquiditySaving(investment)) return start ? `As of ${start}` : null;
  const parts = [];
  if (start) parts.push(start);
  if (maturity) parts.push(`matures ${maturity}`);
  return parts.length ? parts.join(' · ') : null;
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

function InvestmentRow({ investment, idx, href, onDragStart }) {
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
  const dates = planDateLine(investment);
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
    <div ref={hostRef} className={`growth-stage flex items-stretch ${idx > 0 ? 'border-t border-edge' : ''} ${rowTone}`}>
      <div className="flex items-center pl-2">
        <DragHandle onDragStart={onDragStart} />
      </div>
      <Link
        href={href || `/investments/${investment.id}`}
        className="flex flex-1 items-center gap-3 p-3.5 pr-3.5 hover:bg-paper-tint/50 transition relative min-w-0"
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
              {isPrematureWithdrawalStatus(investment.lifecycle_status) && <> · premature withdrawal</>}
              {investment.lifecycle_status === 'closed' && <> · closed</>}
              {investment.lifecycle_status === 'matured' && <> · matured</>}
              {investment.auto_renew && <> · auto-renew</>}
            </>
          )}
          {!metalType && investment.account_holder && investment.account_holder !== 'Self' && <> · {investment.account_holder}</>}
        </p>
        {dates && (
          <p className="text-[11px] text-ink-soft mt-0.5">{dates}</p>
        )}
        <TagList tags={investment.tags} className="mt-1.5" />
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

function savedSplit(items) {
  return items.reduce((totals, investment) => {
    const amount = effectiveInvestedSoFar(investment);
    if (isLiquiditySaving(investment)) totals.liquidity += amount;
    else totals.invested += amount;
    return totals;
  }, { invested: 0, liquidity: 0 });
}

function savedSoFar(investment) {
  const closedWithReceipt = isClosedInvestment(investment) && Number(investment.closure_amount) > 0;
  return {
    amount: closedWithReceipt ? Number(investment.closure_amount) : effectiveInvestedSoFar(investment),
    label: closedWithReceipt ? 'received' : 'saved so far',
  };
}

function InvestmentTile({ investment, href, onDragStart }) {
  const saved = savedSoFar(investment);
  const tone = toneFor(investment.type_code);
  const metalType = isMetalInvestment(investment.type_code);
  const marketType = isMarketInvestment(investment.type_code);
  const lumpSum = isLumpSumInvestment(investment);
  const liquidity = isLiquiditySaving(investment);
  const key = categoryKey(investment);
  const closed = isClosedInvestment(investment);
  const isPremature = isPrematureWithdrawalStatus(investment.lifecycle_status);
  const progress = tenureProgress(investment);
  const kind = growthKindFor(investment, {
    isClosedPlan: closed,
    isPremature,
    progress,
    deducted: hasGrowthDeduction(investment) || isPremature,
  });
  const dates = planDateLine(investment);

  return (
    <div className="flex items-stretch bg-paper-card border border-edge rounded-2xl hover:border-mint-600 transition h-full">
      <div className="flex items-center pl-2">
        <DragHandle onDragStart={onDragStart} />
      </div>
      <Link href={href} className="flex flex-1 gap-3 p-3.5 min-w-0">
      <div className="flex-shrink-0">
        <GrowthAvatar
          kind={kind}
          ratio={progress ? progress.ratio : null}
          typeShort={TYPE_META[investment.type_code]?.short || 'OT'}
          typeCode={investment.type_code}
          customType={investment.custom_type}
          planName={investment.plan_name}
          toneClass={TONE_BG[lumpSum && !closed && !isPremature ? 'mint' : tone]}
          celebrate={false}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug min-w-0">{investment.bank} · {investment.plan_name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-paper-tint border border-edge text-ink-soft flex-shrink-0">{liquidity ? 'Liquidity' : categoryLabel(key)}</span>
        </div>
        {dates && <p className="text-[11px] text-ink-soft mt-1">{dates}</p>}
        <TagList tags={investment.tags} className="mt-1.5" />
        <p className="text-lg font-medium mt-2">{inr(saved.amount)}</p>
        <p className="text-[11px] text-mint-700">{saved.label}{closed ? ` · ${getLifecycleLabel(resolveLifecycleStatus(investment))}` : ''}</p>
        {(isChitInvestment(investment.type_code) || isRecurringFrequency(investment.payment_frequency)) && !closed && (
          <p className="text-[10px] text-ink-mute mt-1">{inr(investment.amount)}{isChitInvestment(investment.type_code) ? ' chit value' : frequencySuffix(investment.payment_frequency)}</p>
        )}
        {metalType && <p className="text-[10px] text-honey-600 mt-1">{formatUnits(investment.total_units)} g held</p>}
        {marketType && <p className="text-[10px] text-sky-600 mt-1">{formatUnits(investment.total_units)} units</p>}
      </div>
      </Link>
    </div>
  );
}

function Plans({ items, layout, readOnly, linkBase, draggingId, dragEnabled, keyPrefix = '', onDragStart, onDrop }) {
  const hrefFor = (investment) => (readOnly ? `${linkBase}/investments/${investment.id}` : `/investments/${investment.id}`);
  if (layout === 'tiles') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((investment) => (
          <div
            key={`${keyPrefix}${investment.id}`}
            onDragOver={(e) => { if (dragEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
            onDrop={(e) => onDrop(e, investment.id)}
            className={draggingId === investment.id ? 'opacity-60' : ''}
          >
            <InvestmentTile
              investment={investment}
              href={hrefFor(investment)}
              onDragStart={dragEnabled ? (e) => onDragStart(e, investment.id) : null}
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
      {items.map((investment, idx) => (
        <div
          key={`${keyPrefix}${investment.id}`}
          onDragOver={(e) => { if (dragEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
          onDrop={(e) => onDrop(e, investment.id)}
          className={draggingId === investment.id ? 'opacity-60' : ''}
        >
          <InvestmentRow
            investment={investment}
            idx={idx}
            href={hrefFor(investment)}
            onDragStart={dragEnabled ? (e) => onDragStart(e, investment.id) : null}
          />
        </div>
      ))}
    </div>
  );
}

export default function InvestmentsClient({ user, initialInvestments = null, readOnly = false, linkBase = '/investments' }) {
  const seeded = Array.isArray(initialInvestments);
  const [investments, setInvestments] = useState(seeded ? initialInvestments : []);
  const [loading, setLoading] = useState(!seeded && !readOnly);
  const [filter, setFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [groupByTag, setGroupByTag] = useState(true);
  const [lifecycleFilter, setLifecycleFilter] = useState('active');
  const [layout, setLayout] = useState('list');
  const [draggingId, setDraggingId] = useState(null);
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'closed' || view === 'all' || view === 'active') {
      setLifecycleFilter(view);
    }
    const tag = params.get('tag');
    if (tag) setTagFilter(tag);
    const stored = window.localStorage.getItem('investments-layout');
    if (stored === 'tiles' || stored === 'list') setLayout(stored);
    // Default on; only turn off when the user previously chose a flat list.
    if (window.localStorage.getItem('investments-group-by-tag') === '0') setGroupByTag(false);
  }, []);

  const chooseLayout = (next) => {
    setLayout(next);
    window.localStorage.setItem('investments-layout', next);
  };

  const chooseTag = (name) => {
    setTagFilter(name);
    const params = new URLSearchParams(window.location.search);
    if (name) params.set('tag', name);
    else params.delete('tag');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  };

  const chooseGroup = (next) => {
    setGroupByTag(next);
    window.localStorage.setItem('investments-group-by-tag', next ? '1' : '0');
  };

  const onInvestmentDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const onInvestmentDrop = async (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (readOnly || !sourceId || sourceId === targetId) return;
    const next = moveVisible(investments, filtered, sourceId, targetId);
    setInvestments(next);
    setOrderError('');
    try {
      const res = await fetch('/api/investments/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the new order.');
    } catch (err) {
      setOrderError(err.message);
    }
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

  const categoryFiltered = filter === 'ALL'
    ? lifecycleScoped
    : investments.filter((investment) => categoryKey(investment) === filter);
  const filtered = tagFilter
    ? categoryFiltered.filter((investment) => hasTag(investment, tagFilter))
    : categoryFiltered;
  const total = filtered.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0);
  const filteredSplit = savedSplit(filtered);
  const selectedCategory = categories.find((item) => item.key === filter);
  const tagStats = summarizeTags(categoryFiltered, {
    amountOf: effectiveInvestedSoFar,
    isLiquidity: isLiquiditySaving,
  });
  const selectedTagName = tagFilter
    ? (tagStats.find((tag) => tag.key === tagKey(tagFilter))?.name || tagFilter)
    : '';
  const grouping = groupByTag && tagStats.length > 0;
  const sections = grouping
    ? (tagFilter
      ? [{ key: tagKey(tagFilter) || 'tag', name: selectedTagName || 'Tag', items: filtered }]
      : groupInvestmentsByTag(filtered))
    : [];
  const filterLabel = [selectedCategory?.label, selectedTagName].filter(Boolean).join(' · ');

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
              {filterLabel ? (
                <>{filterLabel} · {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} · saved so far <span className="font-medium text-ink">{inr(total)}</span></>
              ) : (
                <>{filtered.length} {lifecycleLabel.toLowerCase()} {filtered.length === 1 ? 'plan' : 'plans'} · saved so far <span className="font-medium text-ink">{inr(total)}</span></>
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
          <FilterRail label="Type">
            <FilterChip
              active={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
              title="All types"
              name="All"
              amount={inrShort(lifecycleScoped.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0))}
            />
            {categories.map((category) => (
              <FilterChip
                key={category.key}
                active={filter === category.key}
                onClick={() => setFilter(category.key)}
                title={`${category.label} · ${category.count} · ${inr(category.saved)} saved`}
                name={category.short || category.label}
                count={category.count}
                amount={inrShort(category.saved)}
              />
            ))}
          </FilterRail>
        )}

        {tagStats.length > 0 && (
          <FilterRail
            label="Tag"
            action={(
              <button
                type="button"
                onClick={() => chooseGroup(!groupByTag)}
                aria-pressed={groupByTag}
                title={groupByTag ? 'Show plans as one list' : 'Group plans under each tag'}
                className={`filter-chip filter-chip-action ${groupByTag ? 'on' : ''}`}
              >
                <span className="filter-chip-name">{groupByTag ? 'Grouped by tag' : 'Group by tag'}</span>
              </button>
            )}
          >
            <FilterChip
              active={!tagFilter}
              onClick={() => chooseTag('')}
              title="All tags"
              name="All"
            />
            {tagStats.map((tag) => {
              const amountLabel = tag.invested > 0 && tag.liquidity > 0
                ? `${inr(tag.invested)} invested · ${inr(tag.liquidity)} liquidity`
                : tag.liquidity > 0
                  ? `${inr(tag.liquidity)} liquidity`
                  : `${inr(tag.invested)} saved`;
              return (
                <FilterChip
                  key={tag.key}
                  active={tagKey(tagFilter) === tag.key}
                  onClick={() => chooseTag(tag.name)}
                  title={`${tag.name} · ${tag.count} · ${amountLabel}`}
                  name={tag.name}
                  count={tag.count}
                  amount={inrShort(tag.invested + tag.liquidity)}
                />
              );
            })}
          </FilterRail>
        )}

        {!loading && (selectedCategory || tagFilter) && (
          <div className="mb-4 rounded-2xl border border-edge bg-paper-card px-4 py-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-mute">{filterLabel}</p>
              <p className="text-2xl font-medium">{inr(total)}</p>
            </div>
            <div className="text-xs text-ink-soft text-right">
              <p>saved so far · {filtered.length} {filtered.length === 1 ? 'plan' : 'plans'}</p>
              {filteredSplit.invested > 0 && filteredSplit.liquidity > 0 && (
                <p className="mt-1">{inr(filteredSplit.invested)} invested · {inr(filteredSplit.liquidity)} liquidity</p>
              )}
            </div>
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

        {!loading && investments.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 mb-4 border border-dashed border-edge rounded-xl">
            <p className="text-sm font-medium">Nothing matches this filter</p>
            <button type="button" onClick={() => { setFilter('ALL'); chooseTag(''); }} className="text-sm text-sky-600 mt-2">Clear filters</button>
          </div>
        )}

        {orderError && <p className="text-sm text-danger mb-3">{orderError}</p>}
        {!loading && !readOnly && !grouping && filtered.length > 1 && (
          <p className="text-[11px] text-ink-mute mb-2">Drag the handle to set which plan comes first.</p>
        )}
        {!loading && grouping && filtered.some((investment) => (investment.tags || []).length > 1) && !tagFilter && (
          <p className="text-[11px] text-ink-mute mb-2">A plan with more than one tag is listed under each tag.</p>
        )}
        {!loading && filtered.length > 0 && (
          grouping ? (
            <div className="space-y-5">
              {sections.map((section) => {
                const split = savedSplit(section.items);
                return (
                  <section key={section.key}>
                    <div className="flex items-end justify-between gap-3 mb-2">
                      <h2 className="text-sm font-medium">{section.name}</h2>
                      <p className="text-[11px] text-ink-soft text-right leading-snug">
                        <span className="text-ink-mute">
                          {section.items.length} {section.items.length === 1 ? 'plan' : 'plans'}
                        </span>
                        {split.invested > 0 && split.liquidity > 0 ? (
                          <>
                            {' · '}
                            <span className="font-semibold text-mint-700 tabular-nums">{inr(split.invested)}</span>
                            <span className="text-ink-mute"> invested</span>
                            {' · '}
                            <span className="font-semibold text-sky-600 tabular-nums">{inr(split.liquidity)}</span>
                            <span className="text-ink-mute"> liquidity</span>
                          </>
                        ) : (
                          <>
                            {' · '}
                            <span className="font-semibold text-mint-700 tabular-nums">{inr(split.invested + split.liquidity)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Plans
                      items={section.items}
                      layout={layout}
                      readOnly={readOnly}
                      linkBase={linkBase}
                      draggingId={draggingId}
                      dragEnabled={false}
                      keyPrefix={`${section.key}-`}
                      onDragStart={onInvestmentDragStart}
                      onDrop={onInvestmentDrop}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <Plans
              items={filtered}
              layout={layout}
              readOnly={readOnly}
              linkBase={linkBase}
              draggingId={draggingId}
              dragEnabled={!readOnly}
              onDragStart={onInvestmentDragStart}
              onDrop={onInvestmentDrop}
            />
          )
        )}
      </div>
  );

  if (readOnly) return content;
  return <Shell user={user}>{content}</Shell>;
}
