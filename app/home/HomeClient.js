'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { CoinGlyph, GoalWaterFill, TypeThumbnail, investmentThumbKind } from '@/components/GrowthVisual';
import { inr, inrShort, fmtDate, TYPE_META, toneFor, labelFor, frequencySuffix } from '@/lib/format';
import { effectiveCurrentValue, effectiveInvestedSoFar, isLiquiditySaving, isMarketInvestment, isMetalInvestment, isLumpSumInvestment, tenureProgress } from '@/lib/investments';
import {
  getLifecycleLabel,
  isActiveInvestment,
  isClosedInvestment,
  resolveLifecycleStatus,
} from '@/lib/investment-lifecycle';
import PortfolioChart from './PortfolioChart';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

function startOfDay(value) {
  const dt = new Date(value);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function daysUntil(date, baseDate) {
  return Math.round((startOfDay(date) - startOfDay(baseDate)) / (1000 * 60 * 60 * 24));
}

function eventWhenLabel(date, today) {
  const diff = daysUntil(date, today);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1 && diff <= 30) return `Due in ${diff} days`;
  if (diff < 0) return `Overdue by ${Math.abs(diff)} days`;
  return fmtDate(date);
}

function eventIsSoon(date, today) {
  return daysUntil(date, today) <= 3;
}

function dateKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function nextRecurringDueDate(inv, today) {
  if (!inv.start_date) return null;

  const frequency = inv.payment_frequency;
  const start = startOfDay(inv.start_date);
  const now = startOfDay(today);
  const tenureMonths = Number(inv.tenure_months || 0);

  if (frequency === 'monthly') {
    const installments = tenureMonths;
    if (installments <= 0) return null;

    const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const dueThisMonth = new Date(start);
    dueThisMonth.setMonth(dueThisMonth.getMonth() + monthsDiff);
    const nextIndex = now < start ? 0 : (dueThisMonth <= now ? monthsDiff + 1 : monthsDiff);
    if (nextIndex < 0 || nextIndex >= installments) return null;

    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + nextIndex);
    return nextDate;
  }

  if (frequency === 'yearly') {
    const installments = Math.floor(tenureMonths / 12);
    if (installments <= 0) return null;

    const yearsDiff = now.getFullYear() - start.getFullYear();
    const dueThisYear = new Date(start);
    dueThisYear.setFullYear(dueThisYear.getFullYear() + yearsDiff);
    const nextIndex = now < start ? 0 : (dueThisYear <= now ? yearsDiff + 1 : yearsDiff);
    if (nextIndex < 0 || nextIndex >= installments) return null;

    const nextDate = new Date(start);
    nextDate.setFullYear(nextDate.getFullYear() + nextIndex);
    return nextDate;
  }

  return null;
}

function buildUpcomingEvents(investments) {
  const today = new Date();
  const events = [];

  for (const inv of investments) {
    if (isMarketInvestment(inv.type_code) || isLiquiditySaving(inv) || !isActiveInvestment(inv)) continue;

    const typeLabel = labelFor(inv);
    const shortType = TYPE_META[inv.type_code]?.short || 'OT';
    const dueDate = inv.next_due_date ? startOfDay(inv.next_due_date) : nextRecurringDueDate(inv, today);

    if (dueDate) {
      const overdue = Boolean(inv.next_due_is_overdue) || daysUntil(dueDate, today) < 0;
      events.push({
        key: `${inv.id}-due-${dateKey(dueDate)}`,
        date: dueDate,
        tag: `${shortType} ${inv.payment_frequency === 'yearly' ? 'yearly' : 'monthly'}`,
        title: overdue ? `${typeLabel} contribution overdue` : `${typeLabel} contribution due`,
        detail: `${inv.bank} · ${inv.plan_name}`,
        amountLine: `${inrShort(inv.amount)} contribution`,
        when: eventWhenLabel(dueDate, today),
        soon: eventIsSoon(dueDate, today),
        href: `/investments/${inv.id}`,
        cta: 'View plan',
      });
    }

    if (inv.maturity_date) {
      const maturityDate = startOfDay(inv.maturity_date);
      if (maturityDate >= startOfDay(today)) {
        events.push({
          key: `${inv.id}-maturity-${dateKey(maturityDate)}`,
          date: maturityDate,
          tag: `${shortType} maturity`,
          title: `${typeLabel} matures`,
          detail: `${inv.bank} · ${inv.plan_name}`,
          amountLine: `${inrShort(inv.maturity_value || inv.amount)} projected`,
          when: eventWhenLabel(maturityDate, today),
          soon: eventIsSoon(maturityDate, today),
          href: `/investments/${inv.id}`,
          cta: 'Open details',
        });
      }
    }
  }

  return events
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);
}

/** Small ⓘ tooltip to explain a metric. */
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block ml-1 align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-paper-tint text-ink-mute text-[10px] font-bold leading-none flex items-center justify-center hover:bg-paper-card hover:text-ink transition"
        aria-label="More info"
      >ⓘ</button>
      {open && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-64 bg-ink text-paper text-[11px] rounded-xl p-3 shadow-xl leading-relaxed">
          {text}
        </div>
      )}
    </span>
  );
}

/** Single goal card (gold, silver, or money). */
function GoalCard({ icon, thumb = null, label, tone, currentLabel, currentNote = null, emphasizeCurrent = false, targetLabel, pct, remaining, remainingLabel, onEdit, editing, form, onFormChange, saving, onSave, onRemove, error, hasGoal }) {
  const barClass = { honey: 'goal-bar-gold', sky: 'goal-bar-silver', mint: 'goal-bar-wealth' }[tone] || 'goal-bar-wealth';
  const accumClass = { honey: 'goal-accum-gold', sky: 'goal-accum-silver', mint: 'goal-accum-wealth' }[tone] || 'goal-accum-wealth';
  const accentColor = { honey: 'text-honey-600', sky: 'text-sky-600', mint: 'text-mint-600' }[tone] || 'text-mint-600';
  const borderActive = { honey: 'border-honey-600', sky: 'border-sky-500', mint: 'border-mint-600' }[tone] || 'border-mint-600';

  if (editing) {
    return (
      <div className={`bg-paper-card border ${borderActive} rounded-2xl p-4 flex flex-col`}>
        <p className="text-[11px] font-medium text-ink-soft uppercase tracking-wider mb-3 flex items-center gap-1.5">
          {thumb ? <span className="inline-flex h-5 w-5"><CoinGlyph metal={thumb} /></span> : icon} {label} Goal
        </p>
        <div className="space-y-2 mb-3">
          {form.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-ink-soft mb-1">{f.label}<span className="text-danger ml-0.5">*</span></label>
              <input type="number" step={f.step || '1'} inputMode="numeric" autoFocus={f.auto} value={form.values[f.key]}
                onChange={(e) => onFormChange(f.key, e.target.value)}
                placeholder={f.placeholder} className="field-input" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-ink-soft mb-1">Target date <span className="text-[10px] text-ink-mute">optional</span></label>
            <input type="date" value={form.values.date || ''} onChange={(e) => onFormChange('date', e.target.value)} className="field-input" />
          </div>
        </div>
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex gap-2 mt-auto">
          <button type="button" onClick={() => onEdit(false)} className="btn-ghost py-1.5 px-3 rounded-lg text-xs">Cancel</button>
          {hasGoal && <button type="button" onClick={onRemove} className="btn-ghost py-1.5 px-3 rounded-lg text-xs text-danger hover:border-danger">Remove</button>}
          <button type="button" disabled={saving} onClick={onSave} className="btn-primary flex-1 py-1.5 rounded-lg text-xs font-medium">
            {saving ? 'Saving…' : 'Save goal'}
          </button>
        </div>
      </div>
    );
  }

  if (!hasGoal) {
    return (
      <div className="border border-dashed border-edge rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[140px]">
        {thumb ? <span className="mb-1 inline-flex h-10 w-10"><CoinGlyph metal={thumb} /></span> : <p className="text-2xl mb-1">{icon}</p>}
        <p className="text-sm font-medium">{label} goal</p>
        <p className="text-[11px] text-ink-mute mt-0.5 mb-3">Set a target to track progress</p>
        <button onClick={() => onEdit(true)} className="btn-primary py-1.5 px-3 rounded-full text-xs font-medium">+ Set goal</button>
      </div>
    );
  }

  return (
    <div className="goal-water-card relative bg-paper-card border border-edge rounded-2xl p-4 flex flex-col">
      <GoalWaterFill pct={pct} />
      <div className="goal-on-water flex flex-col flex-1">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-[11px] text-ink-mute uppercase tracking-wider flex items-center gap-1.5">
            {thumb ? <span className="inline-flex h-5 w-5 flex-shrink-0"><CoinGlyph metal={thumb} /></span> : icon} {label} Goal
          </p>
          <p className="text-lg font-medium mt-0.5">{targetLabel}</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-medium ${accentColor}`}>{pct}%</p>
          <p className="text-[10px] text-ink-mute">{remainingLabel}</p>
        </div>
      </div>
      <div className="h-2 bg-paper-tint rounded-full overflow-hidden mb-2">
        <div className={`fill-bar h-full ${barClass} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] flex-1 leading-snug">
        <span className={emphasizeCurrent ? accumClass : 'text-ink-mute'}>{currentLabel}</span>
        {currentNote ? <span className="goal-accum-note"> · {currentNote}</span> : null}
      </p>
      <button onClick={() => onEdit(true)} className={`text-[11px] ${accentColor} hover:underline text-left mt-2`}>edit goal</button>
      </div>
    </div>
  );
}

/** 3-column overall goals row: Gold · Silver · Money */
function GoalTrioSection({ investments, currentValue, investedValue, onMoneyGoalChange }) {
  // ── Money goal state ──
  const [moneyGoal, setMoneyGoal] = useState(null);
  const [editingMoney, setEditingMoney] = useState(false);
  const [moneyForm, setMoneyForm] = useState({ amount: '', date: '' });
  const [savingMoney, setSavingMoney] = useState(false);
  const [moneyError, setMoneyError] = useState('');

  // ── Metal goal state ──
  const [goldTargetG, setGoldTargetG] = useState(null);
  const [silvTargetG, setSilvTargetG] = useState(null);
  const [editingGold, setEditingGold] = useState(false);
  const [editingSilv, setEditingSilv] = useState(false);
  const [goldForm, setGoldForm] = useState({ target: '', date: '' });
  const [silvForm, setSilvForm] = useState({ target: '', date: '' });
  const [savingMetal, setSavingMetal] = useState(false);
  const [metalError, setMetalError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/portfolio-goal').then((r) => r.json()),
      fetch('/api/metal-goals').then((r) => r.json()),
    ]).then(([pg, mg]) => {
      const g = pg.goal;
      setMoneyGoal(g);
      if (g) onMoneyGoalChange(g);
      setGoldTargetG(mg.gold_target_g ?? null);
      setSilvTargetG(mg.silver_target_g ?? null);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Held grams, including matured schemes. A matured gold plan still counts while the weight is held.
  const totalGoldG = investments
    .filter((inv) => inv.type_code === 'GOLD' && Number(inv.total_units || 0) > 0)
    .reduce((sum, inv) => sum + Number(inv.total_units || 0), 0);
  const totalSilvG = investments
    .filter((inv) => inv.type_code === 'SILV' && Number(inv.total_units || 0) > 0)
    .reduce((sum, inv) => sum + Number(inv.total_units || 0), 0);

  // ── Money goal handlers ──
  const saveMoney = async () => {
    if (!moneyForm.amount || Number(moneyForm.amount) <= 0) { setMoneyError('Enter a valid goal amount.'); return; }
    setSavingMoney(true);
    try {
      const res = await fetch('/api/portfolio-goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(moneyForm.amount), date: moneyForm.date || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      const newGoal = { amount: Number(moneyForm.amount), date: moneyForm.date || null };
      setMoneyGoal(newGoal);
      onMoneyGoalChange(newGoal);
      setEditingMoney(false);
    } catch (err) { setMoneyError(err.message); }
    finally { setSavingMoney(false); }
  };
  const removeMoney = async () => {
    await fetch('/api/portfolio-goal', { method: 'DELETE' });
    setMoneyGoal(null); onMoneyGoalChange(null); setEditingMoney(false);
  };

  // ── Metal goal handlers ──
  const saveMetal = async (metal) => {
    const isGold = metal === 'GOLD';
    const form = isGold ? goldForm : silvForm;
    const tg = Number(form.target || 0);
    if (!tg || tg <= 0) { setMetalError('Enter a valid target weight.'); return; }
    setSavingMetal(true);
    try {
      const payload = isGold
        ? { gold_target_g: tg }
        : { silver_target_g: tg };
      const res = await fetch('/api/metal-goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      if (isGold) { setGoldTargetG(tg); setEditingGold(false); }
      else { setSilvTargetG(tg); setEditingSilv(false); }
      setMetalError('');
    } catch (err) { setMetalError(err.message); }
    finally { setSavingMetal(false); }
  };
  const removeMetal = async (metal) => {
    const isGold = metal === 'GOLD';
    await fetch('/api/metal-goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isGold ? { gold_target_g: null } : { silver_target_g: null }),
    });
    if (isGold) { setGoldTargetG(null); setEditingGold(false); }
    else { setSilvTargetG(null); setEditingSilv(false); }
  };

  if (!loaded) return null;

  // ── Progress calculations ──
  const goldPct = goldTargetG > 0 ? Math.min(100, Math.round((totalGoldG / goldTargetG) * 100)) : 0;
  const silvPct = silvTargetG > 0 ? Math.min(100, Math.round((totalSilvG / silvTargetG) * 100)) : 0;
  // Overall wealth fill is invested amount / existing target, capped at 100.
  const moneyPct = moneyGoal?.amount > 0 ? Math.min(100, Math.round((investedValue / moneyGoal.amount) * 100)) : 0;

  const fmtG = (g) => { const n = Number(g || 0); return n.toFixed(n % 1 === 0 ? 0 : 3) + ' g'; };

  return (
    <div className="mb-5">
      <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-3">Overall Goals</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Gold */}
        <GoalCard
          icon="🥇" thumb="gold" label="Gold" tone="honey"
          currentLabel={`${fmtG(totalGoldG)} accumulated`}
          emphasizeCurrent
          targetLabel={goldTargetG ? fmtG(goldTargetG) : '—'}
          pct={goldPct}
          remainingLabel={goldTargetG ? `${fmtG(Math.max(0, goldTargetG - totalGoldG))} to go` : ''}
          hasGoal={goldTargetG != null}
          editing={editingGold}
          onEdit={(v) => { setEditingGold(v); if (v) { setGoldForm({ target: goldTargetG ? String(goldTargetG) : '', date: '' }); setMetalError(''); } }}
          form={{ fields: [{ key: 'target', label: 'Target weight (grams)', placeholder: '100', step: '0.001', auto: true }], values: goldForm }}
          onFormChange={(k, v) => setGoldForm((f) => ({ ...f, [k]: v }))}
          saving={savingMetal} error={metalError}
          onSave={() => saveMetal('GOLD')} onRemove={() => removeMetal('GOLD')}
        />
        {/* Silver */}
        <GoalCard
          icon="🥈" thumb="silver" label="Silver" tone="sky"
          currentLabel={`${fmtG(totalSilvG)} accumulated`}
          emphasizeCurrent
          targetLabel={silvTargetG ? fmtG(silvTargetG) : '—'}
          pct={silvPct}
          remainingLabel={silvTargetG ? `${fmtG(Math.max(0, silvTargetG - totalSilvG))} to go` : ''}
          hasGoal={silvTargetG != null}
          editing={editingSilv}
          onEdit={(v) => { setEditingSilv(v); if (v) { setSilvForm({ target: silvTargetG ? String(silvTargetG) : '', date: '' }); setMetalError(''); } }}
          form={{ fields: [{ key: 'target', label: 'Target weight (grams)', placeholder: '500', step: '0.001', auto: true }], values: silvForm }}
          onFormChange={(k, v) => setSilvForm((f) => ({ ...f, [k]: v }))}
          saving={savingMetal} error={metalError}
          onSave={() => saveMetal('SILV')} onRemove={() => removeMetal('SILV')}
        />
        {/* Money */}
        <GoalCard
          icon="💰" label="Overall Wealth" tone="mint"
          currentLabel={`${inrShort(investedValue)} invested`}
          currentNote={`${inrShort(currentValue)} projected`}
          emphasizeCurrent
          targetLabel={moneyGoal ? inrShort(moneyGoal.amount) : '—'}
          pct={moneyPct}
          remainingLabel={moneyGoal ? `${inrShort(Math.max(0, moneyGoal.amount - investedValue))} to go` : ''}
          hasGoal={moneyGoal != null}
          editing={editingMoney}
          onEdit={(v) => { setEditingMoney(v); if (v) { setMoneyForm({ amount: moneyGoal?.amount ? String(moneyGoal.amount) : '', date: moneyGoal?.date ? String(moneyGoal.date).slice(0, 10) : '' }); setMoneyError(''); } }}
          form={{ fields: [{ key: 'amount', label: 'Target amount (₹)', placeholder: '5000000', auto: true }], values: moneyForm }}
          onFormChange={(k, v) => setMoneyForm((f) => ({ ...f, [k]: v }))}
          saving={savingMoney} error={moneyError}
          onSave={saveMoney} onRemove={removeMoney}
        />
      </div>
    </div>
  );
}

export default function HomeClient({ user }) {
  const [goals, setGoals] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portfolioGoal, setPortfolioGoal] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/goals').then((r) => r.json()),
      fetch('/api/investments').then((r) => r.json()),
    ]).then(([g, i]) => {
      setGoals(g.goals || []);
      setInvestments(i.investments || []);
      setLoading(false);
    });
  }, []);

  const activeInvestments = investments.filter(isActiveInvestment);
  const closedInvestments = investments.filter(isClosedInvestment);

  // totalValue = sum of maturity values for active plans (future projected value)
  const totalValue = activeInvestments.reduce((sum, inv) => sum + effectiveCurrentValue(inv), 0);
  const totalCurrentPortfolioValue = activeInvestments.reduce(
    (sum, inv) => sum + (isMarketInvestment(inv.type_code) ? effectiveCurrentValue(inv) : effectiveInvestedSoFar(inv)),
    0
  );
  const totalInvested = activeInvestments.reduce((sum, inv) => sum + effectiveInvestedSoFar(inv), 0);
  const liquidityHeld = activeInvestments
    .filter((inv) => isLiquiditySaving(inv))
    .reduce((sum, inv) => sum + (isMarketInvestment(inv.type_code) ? effectiveCurrentValue(inv) : effectiveInvestedSoFar(inv)), 0);
  const closedReceivedTotal = closedInvestments.reduce((sum, inv) => {
    if (Number(inv.closure_amount) > 0) return sum + Number(inv.closure_amount);
    return sum + effectiveCurrentValue(inv);
  }, 0);

  const maturingSoon = activeInvestments.filter((inv) => {
    if (isMarketInvestment(inv.type_code) || isLiquiditySaving(inv) || !inv.maturity_date) return false;
    const days = (new Date(inv.maturity_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  }).length;

  const upcomingEvents = buildUpcomingEvents(activeInvestments);

  const empty = !loading && goals.length === 0 && investments.length === 0;

  return (
    <Shell user={user}>
      {loading && (
        <div className="p-5 md:p-8">
          <div className="h-6 w-24 bg-paper-tint rounded animate-pulse mb-3"></div>
          <div className="h-10 w-48 bg-paper-tint rounded animate-pulse"></div>
        </div>
      )}

      {empty && (
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="text-center max-w-sm anim-fade">
            <div className="w-16 h-16 mx-auto rounded-full bg-mint-50 text-mint-600 flex items-center justify-center text-3xl font-light mb-4">+</div>
            <h2 className="text-xl font-medium mb-2">Welcome, {user.name.split(' ')[0]}!</h2>
            <p className="text-sm text-ink-soft mb-6 leading-relaxed">Start by adding what you want to save for, or add an investment you already have.</p>
            <div className="flex flex-col gap-2.5">
              <Link href="/goals/new" className="btn-primary py-2.5 px-4 rounded-lg text-sm font-medium">Add a goal</Link>
              <Link href="/investments/new" className="btn-ghost py-2.5 px-4 rounded-lg text-sm">Add an investment</Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !empty && (
        <div className="px-4 md:px-8 py-5 md:py-6 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 md:gap-5 items-start">
            <div className="min-w-0">
              {/* ── Header ── */}
              <div className="md:flex md:items-end md:justify-between mb-5">
                <div>
                  <p className="text-[11px] tracking-wider text-ink-mute uppercase">Current Portfolio Value</p>
                  <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-1">{inr(totalCurrentPortfolioValue)}</h1>
                  <p className="text-sm text-ink-soft mt-1.5">Projected maturity value: {inr(totalValue)}</p>
                  {liquidityHeld > 0 && (
                    <p className="text-sm text-ink-soft mt-0.5">{inr(totalCurrentPortfolioValue - liquidityHeld)} invested · {inr(liquidityHeld)} kept for liquidity</p>
                  )}
                </div>
                <Link href="/investments/new" className="hidden md:inline-flex items-center gap-1.5 btn-primary py-2 px-4 rounded-full text-sm font-medium">+ Add investment</Link>
              </div>

              {/* ── Stat cards ── */}
              <div className="home-stat-grid">
                <Link href="/investments?view=active" className="home-stat">
                  <p className="home-stat-label">Active plans</p>
                  <p className="home-stat-value">{activeInvestments.length} <span className="home-stat-arrow">→</span></p>
                  <p className="home-stat-note" aria-hidden="true">&nbsp;</p>
                </Link>
                <Link href="/investments?view=closed" className="home-stat">
                  <p className="home-stat-label">Closed plans</p>
                  <p className="home-stat-value">{closedInvestments.length} <span className="home-stat-arrow">→</span></p>
                  <p className="home-stat-note">
                    {closedInvestments.length > 0 ? `${inrShort(closedReceivedTotal)} received` : '\u00a0'}
                  </p>
                </Link>
                <Link href="/investments?view=active" className="home-stat">
                  <p className="home-stat-label">Maturing in 30 days</p>
                  <p className="home-stat-value home-stat-value-honey">{maturingSoon} <span className="home-stat-arrow">→</span></p>
                  <p className="home-stat-note" aria-hidden="true">&nbsp;</p>
                </Link>
                <Link href="/goals" className="home-stat">
                  <p className="home-stat-label">Goals</p>
                  <p className="home-stat-value">{goals.length} <span className="home-stat-arrow">→</span></p>
                  <p className="home-stat-note" aria-hidden="true">&nbsp;</p>
                </Link>
                <Link href="/investments?view=active" className="home-stat">
                  <p className="home-stat-label">
                    Maturity value
                    <InfoTip text="The total amount you will receive when all active investments mature at their respective rates. Closed plans are excluded." />
                  </p>
                  <p className="home-stat-value home-stat-value-mint">{inrShort(totalValue)}</p>
                  <p className="home-stat-note" aria-hidden="true">&nbsp;</p>
                </Link>
              </div>

              {/* ── Overall Goals (Gold · Silver · Money) ── */}
              <GoalTrioSection investments={investments} currentValue={totalValue} investedValue={totalInvested} onMoneyGoalChange={setPortfolioGoal} />

              {/* ── Portfolio projection chart ── */}
              <div className="mb-5">
                <PortfolioChart
                  investments={activeInvestments.filter((inv) => !isLiquiditySaving(inv))}
                  goalAmount={portfolioGoal?.amount ?? null}
                  goalDate={portfolioGoal?.date ?? null}
                />
              </div>

              {/* ── Recent investments ── */}
              <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
                <div className="flex justify-between items-baseline mb-3">
                  <h2 className="text-sm font-medium">Recent investments</h2>
                  <Link href="/investments" className="text-xs text-sky-600">view all</Link>
                </div>
                {investments.slice(0, 4).map((investment) => {
                  const tone = toneFor(investment.type_code);
                  const marketType = isMarketInvestment(investment.type_code);
                  const metalType = isMetalInvestment(investment.type_code);
                  const lumpSum = isLumpSumInvestment(investment);
                  const closedPlan = isClosedInvestment(investment);
                  const lifecycleLabel = getLifecycleLabel(resolveLifecycleStatus(investment));
                  const progress = tenureProgress(investment);
                  const investedSoFar = effectiveInvestedSoFar(investment);
                  const suffix = frequencySuffix(investment.payment_frequency);
                  const thumbKind = investmentThumbKind(investment.type_code, investment.custom_type, investment.plan_name);
                  return (
                    <Link key={investment.id} href={`/investments/${investment.id}`} className="flex items-center justify-between py-2.5 border-b border-edge last:border-b-0 hover:bg-paper-tint/50 -mx-2 px-2 rounded transition">
                      <div className="flex gap-2.5 items-center min-w-0 flex-1">
                        {thumbKind ? (
                          <div className="w-8 h-8 flex-shrink-0">
                            <TypeThumbnail
                              typeCode={investment.type_code}
                              customType={investment.custom_type}
                              planName={investment.plan_name}
                              ratio={progress ? progress.ratio : null}
                              wilted={Boolean(progress?.deducted)}
                              complete={Boolean(progress?.complete)}
                            />
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${lumpSum && !closedPlan ? TONE_BG.mint : TONE_BG[tone]}`}>{TYPE_META[investment.type_code]?.short || 'OT'}</div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {investment.bank} · {investment.plan_name}
                            {isLiquiditySaving(investment) && <span className="ml-1.5 align-middle text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-600/30 font-medium tracking-wide uppercase">Liquidity</span>}
                          </p>
                          <p className="text-[11px] text-ink-mute mt-0.5">
                            {closedPlan && <span className="text-ink-soft font-medium">{lifecycleLabel} · </span>}
                            {labelFor(investment)}
                            {progress && <> · {progress.label}</>}
                            {isLiquiditySaving(investment) ? ' · available' : metalType ? ` · ${formatUnits(investment.total_units)} g accumulated` : marketType ? ` · ${formatUnits(investment.total_units)} units held` : closedPlan && investment.closure_date ? ` · closed ${fmtDate(investment.closure_date)}` : ` · matures ${fmtDate(investment.maturity_date)}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        {metalType ? (
                          <>
                            <p className="text-xs font-medium">{formatUnits(investment.total_units)} g</p>
                            <p className="text-[10px] mt-0.5 text-honey-600">{inrShort(investment.remaining_cost_basis || 0)} cost</p>
                          </>
                        ) : marketType ? (
                          <>
                            <p className="text-xs font-medium">{inrShort(investment.remaining_cost_basis)}</p>
                            <p className="text-[10px] mt-0.5 text-sky-600">{inrShort(investment.invested_amount)} invested</p>
                          </>
                        ) : isLiquiditySaving(investment) ? (
                          <>
                            <p className="text-xs font-medium">{inrShort(investment.amount)}</p>
                            <p className="text-[10px] mt-0.5 text-sky-600">available</p>
                          </>
                        ) : lumpSum ? (
                          <>
                            <p className="text-xs font-medium achieved-amount">{inrShort(investedSoFar)}</p>
                            <p className="text-[10px] mt-0.5 text-mint-700">achieved{progress ? ` · ${progress.label}` : ''}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-medium">{inrShort(investment.amount)}{suffix}</p>
                            <p className="text-[10px] mt-0.5 text-mint-700">{inrShort(investedSoFar)} invested{progress ? ` · ${progress.label}` : ''}</p>
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </section>
            </div>

            <aside className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5 lg:sticky lg:top-4">
              <section>
                <div className="flex justify-between items-baseline mb-3">
                  <h2 className="text-sm font-medium">Goals</h2>
                  <Link href="/goals" className="text-xs text-sky-600">see all</Link>
                </div>
                {goals.length === 0 ? (
                  <Link href="/goals/new" className="block text-center py-4 text-sm text-ink-mute border border-dashed border-edge rounded-xl hover:bg-paper-tint">+ Add your first goal</Link>
                ) : goals.slice(0, 3).map((g) => {
                  const cur = Number(g.current_amount || 0);
                  const tgt = Number(g.target_amount || 1);
                  const pct = Math.min(100, Math.round((cur / tgt) * 100));
                  return (
                    <Link key={g.id} href="/goals" className="growth-stage goal-water-card block bg-paper-tint rounded-xl p-3 mb-2 hover:bg-paper-card hover:border hover:border-edge transition overflow-hidden">
                      <GoalWaterFill pct={pct} />
                      <div className="goal-on-water">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium truncate pr-2">{g.name}</span>
                          <span className={`text-xs ${pct >= 100 ? 'achieved-amount font-medium' : 'text-ink-soft'}`}>{pct}%{pct >= 100 ? ' 👏' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-paper-card rounded-full overflow-hidden">
                          <div className="fill-bar h-full bg-mint-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </section>

              <section className="mt-5 pt-4 border-t border-edge">
                <div className="mb-3">
                  <h2 className="text-sm font-medium">Upcoming events</h2>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div className="text-[11px] text-ink-mute text-center py-2">No upcoming events</div>
                ) : (
                  <div className="space-y-2">
                    {upcomingEvents.slice(0, 2).map((event) => (
                      <Link key={event.key} href={event.href} className={event.soon ? 'event-due-card block rounded-lg p-2 transition text-[11px]' : 'block border border-edge rounded-lg p-2 bg-paper-tint/60 hover:border-mint-600 transition text-[11px]'}>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="font-medium truncate flex-1">{event.title}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-mint-50 text-mint-700 border border-mint-100 whitespace-nowrap flex-shrink-0">{event.tag}</span>
                        </div>
                        <p className="text-ink-mute truncate mb-1">{event.detail}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className={event.soon ? 'event-due-badge' : 'text-ember-600 font-medium text-[10px]'}>{event.when}</span>
                          <span className="text-sky-600 text-[10px]">View →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

            </aside>
          </div>
        </div>
      )}
    </Shell>
  );
}
