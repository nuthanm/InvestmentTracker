'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { GoalWaterFill, TypeThumbnail, investmentThumbKind, useCelebrateOnce } from '@/components/GrowthVisual';
import { inr, fmtDate, labelFor } from '@/lib/format';
import { effectiveInvestedSoFar, isMetalInvestment, tenureProgress } from '@/lib/investments';
import { isActiveInvestment, resolveLifecycleStatus, LIFECYCLE_STATUSES } from '@/lib/investment-lifecycle';

const FILL_COLORS = ['#0F6E56', '#185FA5', '#993C1D', '#854F0B', '#3C3489', '#72243E'];
const ICONS = ['house', 'car', 'education', 'travel', 'wedding', 'other'];

const computeProjectedGoal = (value, inflationPct, targetDate) => {
  const base = Number(value);
  const rate = Number(inflationPct || 0);
  if (!base || base <= 0 || !targetDate) return base || 0;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return base;
  const days = Math.max(0, (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const years = days / 365.25;
  return base * Math.pow(1 + (rate / 100), years);
};

const getSavingsPace = (targetAmount, targetDate, currentAmount = 0) => {
  const remaining = Math.max(0, Number(targetAmount || 0) - Number(currentAmount || 0));
  if (!remaining || !targetDate) return { daily: 0, monthly: 0 };
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return { daily: 0, monthly: 0 };
  const days = Math.max(1, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  return {
    daily: remaining / days,
    monthly: remaining / Math.max(1, Math.ceil(days / 30)),
  };
};

function GoalCard({
  goal: g,
  idx,
  investments,
  isEditing,
  isExpanded,
  editForm,
  setEditForm,
  editError,
  editSaving,
  confirmDeleteId,
  onToggleExpand,
  onOpenEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const cur = Number(g.current_amount || 0);
  const tgt = Number(g.target_amount || 1);
  const progressRatio = tgt > 0 ? cur / tgt : 0;
  const pct = Math.min(100, Math.floor(progressRatio * 100));
  const reached = progressRatio >= 1;
  const color = FILL_COLORS[idx % FILL_COLORS.length];
  const nearGoal = progressRatio >= 0.85 && !reached;
  const hasDescription = !!g.description?.trim();
  const savingsPace = getSavingsPace(tgt, g.target_date, cur);
  const { hostRef, originRef } = useCelebrateOnce(`goal-${g.id}`, reached);

  return (
    <div
      ref={hostRef}
      onClick={isEditing ? undefined : onToggleExpand}
      className={`growth-stage goal-water-card bg-paper-card border border-edge rounded-2xl p-4 mb-3 transition ${reached ? 'bg-mint-50/50 border-mint-600/40' : 'overflow-hidden'} ${isEditing ? 'border-mint-600' : 'cursor-pointer hover:border-mint-600'}`}
    >
      {!isEditing ? <GoalWaterFill pct={pct} /> : null}
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} className="space-y-3 relative z-[1]">
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-1">Edit goal</p>
          <div>
            <label className="block text-xs text-ink-soft mb-1">Goal name<span className="text-danger ml-0.5">*</span></label>
            <input type="text" autoFocus value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="field-input"/>
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">Description</label>
            <textarea rows={3} value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Add any important details, milestones, or notes for this goal."
              className="field-input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-ink-soft mb-1">Value today (₹)<span className="text-danger ml-0.5">*</span></label>
              <input type="number" inputMode="numeric" value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                className="field-input"/>
            </div>
            <div>
              <label className="block text-xs text-ink-soft mb-1">Inflation (%)</label>
              <input type="number" step="0.1" min="0" value={editForm.inflationPct}
                onChange={(e) => setEditForm((f) => ({ ...f, inflationPct: e.target.value }))}
                className="field-input"/>
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">Target date <span className="text-danger ml-0.5">*</span></label>
            <input type="date" value={editForm.date}
              onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
              className="field-input"/>
          </div>
          {Number(editForm.amount) > 0 && editForm.date && (
            <div className="rounded-xl border border-mint-200 bg-mint-50 px-3 py-2 space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-mint-700 mb-1">Expected goal amount based on target date</p>
                <p className="text-sm font-medium text-mint-800">₹{Number(computeProjectedGoal(editForm.amount, editForm.inflationPct, editForm.date)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-mint-800">
                <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(getSavingsPace(computeProjectedGoal(editForm.amount, editForm.inflationPct, editForm.date), editForm.date).daily).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/day</span>
                <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(getSavingsPace(computeProjectedGoal(editForm.amount, editForm.inflationPct, editForm.date), editForm.date).monthly).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month</span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-ink-soft mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((ic) => (
                <button key={ic} type="button"
                  onClick={() => setEditForm((f) => ({ ...f, icon: ic }))}
                  className={`chip capitalize text-[11px] py-1 ${editForm.icon === ic ? 'on' : ''}`}>{ic}</button>
              ))}
            </div>
          </div>
          {editError && <p className="text-xs text-danger">{editError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancelEdit}
              className="btn-ghost py-1.5 px-4 rounded-lg text-xs">Cancel</button>
            <button type="button" disabled={editSaving} onClick={(e) => onSaveEdit(e, g.id)}
              className="btn-primary flex-1 py-1.5 rounded-lg text-xs font-medium">
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="goal-on-water">
          <div className="flex justify-between items-start mb-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{g.name}</span>
                {nearGoal && <span className="pulse-soft text-[10px] bg-mint-50 text-mint-700 px-1.5 py-0.5 rounded-full">near goal</span>}
                {reached && <span className="text-[10px] bg-mint-600 text-paper px-1.5 py-0.5 rounded-full">reached! 👏</span>}
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {inr(cur)} of {inr(tgt)}
                {g.target_date && <> · target {fmtDate(g.target_date)}</>}
                <> · {g.investment_count} {g.investment_count == 1 ? 'investment' : 'investments'}</>
              </p>
            </div>
            <div ref={originRef} className="text-right ml-3 flex-shrink-0">
              <span className={`text-sm font-medium ${reached ? 'achieved-amount' : ''}`}>{pct}%</span>
            </div>
          </div>
          <div className="h-2 bg-paper-tint rounded-full overflow-hidden">
            <div className="fill-bar h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-edge space-y-2">
              {hasDescription && (
                <div className="rounded-lg bg-paper-tint border border-edge px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-soft mb-1">Details</p>
                  <p className="text-xs text-ink">{g.description}</p>
                </div>
              )}
              {g.target_date && (
                <div className="rounded-lg border border-mint-200 bg-mint-50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-mint-700 mb-1">Need to save</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-mint-800">
                    <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(savingsPace.daily).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/day</span>
                    <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(savingsPace.monthly).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month</span>
                  </div>
                </div>
              )}
              {investments.length === 0 ? (
                <p className="text-xs text-ink-soft">No investments linked to this goal yet.</p>
              ) : (
                investments.map((investment) => {
                  const active = isActiveInvestment(investment);
                  const countedTowardGoal = active || isMetalInvestment(investment.type_code);
                  const status = resolveLifecycleStatus(investment);
                  const statusLabel = status === LIFECYCLE_STATUSES.MATURED ? 'Matured'
                    : status === LIFECYCLE_STATUSES.PREMATURE_WITHDRAWAL ? 'Withdrawn'
                    : 'Closed';
                  const progress = tenureProgress(investment);
                  const thumbKind = investmentThumbKind(investment.type_code, investment.custom_type, investment.plan_name);
                  return (
                    <Link
                      key={investment.id}
                      href={`/investments/${investment.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`block rounded-lg border px-2.5 py-2 transition ${active ? 'border-edge hover:border-mint-600' : 'border-edge bg-paper-tint opacity-70 hover:opacity-100'}`}
                    >
                      <div className="flex items-start gap-2">
                        {thumbKind ? (
                          <span className="mt-0.5 h-7 w-7 flex-shrink-0">
                            <TypeThumbnail
                              typeCode={investment.type_code}
                              customType={investment.custom_type}
                              planName={investment.plan_name}
                              ratio={progress ? progress.ratio : null}
                              wilted={Boolean(progress?.deducted)}
                              complete={Boolean(progress?.complete)}
                            />
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium truncate flex-1">{investment.bank || 'Unknown'} · {investment.plan_name || 'Untitled plan'}</p>
                        {!active && (
                          <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-ink-mute/10 text-ink-mute border border-ink-mute/20">
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5 text-ink-soft">
                        {labelFor(investment)} · <span className={countedTowardGoal ? '' : 'line-through'}>{inr(effectiveInvestedSoFar(investment))}</span>
                        {progress && <> · {progress.label}</>}
                        {!countedTowardGoal && <span className="ml-1 italic">not counted</span>}
                      </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
          <div className="flex justify-end items-center gap-1.5 mt-2">
            <button type="button" onClick={onOpenEdit}
              className="rounded-full border border-edge bg-paper-card px-2.5 py-0.5 text-xs font-medium leading-none text-ink shadow-[0_1px_2px_rgba(14,23,20,0.12)] [text-shadow:none] hover:bg-paper">Edit</button>
            {confirmDeleteId === g.id ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-danger/25 bg-paper-card px-1.5 py-0.5 shadow-[0_1px_2px_rgba(14,23,20,0.12)] [text-shadow:none]">
                <span className="px-1 text-[11px] font-medium leading-none text-ink">Sure?</span>
                <button type="button" onClick={(e) => onDelete(e, g.id)}
                  className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold leading-none text-danger [text-shadow:none] hover:bg-[#f6d6d6]">Yes</button>
                <button type="button" onClick={onCancelDelete}
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium leading-none text-ink [text-shadow:none] hover:bg-paper-tint">No</button>
              </span>
            ) : (
              <button type="button" onClick={(e) => onConfirmDelete(e, g.id)}
                className="rounded-full border border-danger/30 bg-paper-card px-2.5 py-0.5 text-xs font-medium leading-none text-danger shadow-[0_1px_2px_rgba(14,23,20,0.12)] [text-shadow:none] hover:bg-danger-soft">Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsClient({ user }) {
  const [goals, setGoals] = useState([]);
  const [investmentsByGoal, setInvestmentsByGoal] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', amount: '', inflationPct: '0', date: '', icon: 'house' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = () => {
    setLoadError('');
    Promise.all([
      fetch('/api/goals').then((r) => r.json()),
      fetch('/api/investments').then((r) => r.json()),
    ]).then(([goalsData, investmentsData]) => {
      const grouped = (investmentsData.investments || []).reduce((acc, investment) => {
        if (!investment.goal_id) return acc;
        if (!acc[investment.goal_id]) acc[investment.goal_id] = [];
        acc[investment.goal_id].push(investment);
        return acc;
      }, {});
      setGoals(goalsData.goals || []);
      setInvestmentsByGoal(grouped);
      setLoading(false);
    }).catch(() => {
      setLoadError('Could not load goals right now. Please try again.');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openEdit = (e, g) => {
    e.stopPropagation();
    setEditId(g.id);
    setEditForm({
      name: g.name,
      description: g.description || '',
      amount: String(g.target_amount),
      inflationPct: String(g.inflation_pct ?? 0),
      date: g.target_date ? g.target_date.slice(0, 10) : '',
      icon: g.icon || 'house',
    });
    setEditError('');
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditId(null);
    setEditError('');
  };

  const saveEdit = async (e, id) => {
    e.stopPropagation();
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError('Enter a valid value.'); return; }
    if (!editForm.date) { setEditError('Target date is required.'); return; }
    if (Number(editForm.inflationPct) < 0) { setEditError('Inflation percentage must be zero or more.'); return; }
    const projectedAmount = computeProjectedGoal(editForm.amount, editForm.inflationPct, editForm.date);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          target_amount: Number(projectedAmount.toFixed(2)),
          target_date: editForm.date,
          inflation_pct: Number(editForm.inflationPct) || 0,
          icon: editForm.icon,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update.');
      setEditId(null);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = async (e, id) => {
    e.stopPropagation();
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    load();
  };

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full relative min-h-full">

        <div className="flex justify-between items-end mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Goals</h1>
            <p className="text-sm text-ink-soft mt-1">tap a goal to view linked investments · crackers fire when a goal is reached</p>
          </div>
          <Link href="/goals/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium">+ New goal</Link>
        </div>

        {loading && <div className="h-20 bg-paper-tint rounded-xl animate-pulse" />}
        {!loading && loadError && <p className="text-sm text-danger mb-3">{loadError}</p>}

        {!loading && goals.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-full bg-mint-50 text-mint-600 flex items-center justify-center text-2xl font-light mb-3">+</div>
            <p className="text-base font-medium mb-1">No goals yet</p>
            <p className="text-sm text-ink-soft mb-5">Set your first goal to start tracking progress.</p>
            <Link href="/goals/new" className="btn-primary py-2.5 px-5 rounded-lg text-sm font-medium inline-block">Create a goal</Link>
          </div>
        )}

        {!loading && goals.map((g, idx) => (
          <GoalCard
            key={g.id}
            goal={g}
            idx={idx}
            investments={investmentsByGoal[g.id] || []}
            isEditing={editId === g.id}
            isExpanded={expandedGoalId === g.id}
            editForm={editForm}
            setEditForm={setEditForm}
            editError={editError}
            editSaving={editSaving}
            confirmDeleteId={confirmDeleteId}
            onToggleExpand={() => setExpandedGoalId((prev) => (prev === g.id ? null : g.id))}
            onOpenEdit={(e) => openEdit(e, g)}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={onDelete}
            onConfirmDelete={(e, id) => { e.stopPropagation(); setConfirmDeleteId(id); }}
            onCancelDelete={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
          />
        ))}

      </div>
    </Shell>
  );
}
