'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import TagField from '@/components/TagField';
import TagList from '@/components/TagList';
import { GoalWaterFill, TypeThumbnail, investmentThumbKind, useCelebrateOnce } from '@/components/GrowthVisual';
import { inr, fmtDate, labelFor } from '@/lib/format';
import { effectiveInvestedSoFar, isMetalInvestment, tenureProgress } from '@/lib/investments';
import { isActiveInvestment, resolveLifecycleStatus, LIFECYCLE_STATUSES } from '@/lib/investment-lifecycle';
import { goalOutcomeStatus, goalScopeYear, isCommonGoal, isLiquidityGoal, isRecurringYearlyGoal } from '@/lib/goals';
import { investmentTags } from '@/lib/tags';

const FILL_COLORS = ['#0F6E56', '#185FA5', '#993C1D', '#854F0B', '#3C3489', '#72243E'];
const ICONS = ['house', 'car', 'education', 'travel', 'wedding', 'other'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 5 + i);

function ScopeFields({ scope, year, recurringYearly, onScopeChange, onYearChange, onRecurringChange }) {
  const years = YEAR_OPTIONS.includes(year) ? YEAR_OPTIONS : [...YEAR_OPTIONS, year].sort((a, b) => a - b);
  return (
    <div>
      <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Scope</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onScopeChange('common')}
          className={`text-left rounded-xl border px-3 py-2 transition ${scope === 'common' ? 'border-mint-600 bg-mint-50' : 'border-edge'}`}
        >
          <p className="text-sm font-medium">Life goal</p>
          <p className="text-[11px] text-ink-soft mt-0.5">Ongoing, not tied to a year</p>
        </button>
        <button
          type="button"
          onClick={() => onScopeChange('year')}
          className={`text-left rounded-xl border px-3 py-2 transition ${scope === 'year' ? 'border-mint-600 bg-mint-50' : 'border-edge'}`}
        >
          <p className="text-sm font-medium">Year goal</p>
          <p className="text-[11px] text-ink-soft mt-0.5">Counts toward a calendar year</p>
        </button>
      </div>
      {scope === 'year' && (
        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-xs text-ink-soft mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="field-input"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-edge px-3 py-2 cursor-pointer hover:border-mint-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!recurringYearly}
              onChange={(e) => onRecurringChange(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Repeats every year</span>
              <span className="block text-[11px] text-ink-soft mt-0.5">Marks this as a yearly repeating goal.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function YearStatsChart({ title, rows }) {
  if (!rows.length) return null;
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <section className="mt-8 pt-6 border-t border-edge">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-ink-mute">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-mint-600" /> Completed</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#185FA5]" /> Pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-danger" /> Not yet</span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const completedPct = (row.completed / maxTotal) * 100;
          const pendingPct = (row.pending / maxTotal) * 100;
          const notYetPct = (row.not_yet / maxTotal) * 100;
          const parts = [
            row.completed > 0 ? `${row.completed} completed` : null,
            row.pending > 0 ? `${row.pending} pending` : null,
            row.not_yet > 0 ? `${row.not_yet} not yet` : null,
          ].filter(Boolean);
          return (
            <div key={row.year} className="flex items-center gap-3 sm:gap-4">
              <p className="w-12 flex-shrink-0 text-sm font-medium tabular-nums">{row.year}</p>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 rounded-full bg-paper-tint overflow-hidden flex">
                  {row.completed > 0 && (
                    <div className="h-full bg-mint-600" style={{ width: `${completedPct}%` }} title={`${row.completed} completed`} />
                  )}
                  {row.pending > 0 && (
                    <div className="h-full bg-[#185FA5]" style={{ width: `${pendingPct}%` }} title={`${row.pending} pending`} />
                  )}
                  {row.not_yet > 0 && (
                    <div className="h-full bg-danger" style={{ width: `${notYetPct}%` }} title={`${row.not_yet} not yet`} />
                  )}
                </div>
                {parts.length > 0 && (
                  <p className="mt-1 text-[11px] text-ink-mute truncate">{parts.join(' · ')}</p>
                )}
              </div>
              <p className="flex-shrink-0 text-[11px] text-ink-mute tabular-nums w-14 text-right">
                {row.total}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalAttrTag({ children }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-600/30 font-medium flex-shrink-0">
      {children}
    </span>
  );
}

function goalTargetLabel(goal, liquidity) {
  if (liquidity) return 'No end date — keep this buffer available';
  if (goal?.target_date) return `Target ${fmtDate(goal.target_date)}`;
  return 'No target date for this goal';
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
      className="cursor-grab active:cursor-grabbing text-ink-mute hover:text-ink px-1 text-sm leading-none flex-shrink-0"
    >
      ⋮⋮
    </button>
  );
}

function moveItem(items, fromId, toId) {
  const next = items.slice();
  const from = next.findIndex((item) => item.id === fromId);
  const to = next.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function LayoutToggle({ value, onChange }) {
  return (
    <div className="flex rounded-full border border-edge overflow-hidden text-[11px] flex-shrink-0">
      <button type="button" onClick={() => onChange('list')} className={`px-2.5 py-1 ${value === 'list' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>List</button>
      <button type="button" onClick={() => onChange('tiles')} className={`px-2.5 py-1 ${value === 'tiles' ? 'bg-ink text-paper' : 'bg-paper-card text-ink-soft'}`}>Tiles</button>
    </div>
  );
}

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
  knownTags,
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
  layout = 'tiles',
  onDragStart,
}) {
  const cur = Number(g.current_amount || 0);
  const liquidity = isLiquidityGoal(g);
  const recurring = isRecurringYearlyGoal(g);
  const tgt = Number((liquidity ? g.required_amount : g.target_amount) || 1);
  const progressRatio = tgt > 0 ? cur / tgt : 0;
  const pct = Math.min(100, Math.floor(progressRatio * 100));
  const reached = progressRatio >= 1;
  const color = FILL_COLORS[idx % FILL_COLORS.length];
  const nearGoal = progressRatio >= 0.85 && !reached;
  const hasDescription = !!g.description?.trim();
  const savingsPace = getSavingsPace(tgt, g.target_date, cur);
  const { hostRef, originRef } = useCelebrateOnce(`goal-${g.id}`, reached);
  const compact = layout === 'list' && !isEditing;

  return (
    <div
      ref={hostRef}
      onClick={isEditing ? undefined : onToggleExpand}
      className={`growth-stage goal-water-card bg-paper-card border border-edge transition overflow-hidden ${compact ? 'rounded-xl mb-2' : `rounded-2xl p-4 ${layout === 'tiles' ? 'mb-0 h-full' : 'mb-3'}`} ${reached && !compact ? 'bg-mint-50/50 border-mint-600/40' : ''} ${isEditing ? 'border-mint-600' : 'cursor-pointer hover:border-mint-600'}`}
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
          <div>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Purpose</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditForm((f) => ({ ...f, forLiquidity: false }))} className={`text-left rounded-xl border px-3 py-2 transition ${!editForm.forLiquidity ? 'border-mint-600 bg-mint-50' : 'border-edge'}`}>
                <p className="text-sm font-medium">Goal with a date</p>
              </button>
              <button type="button" onClick={() => setEditForm((f) => ({ ...f, forLiquidity: true }))} className={`text-left rounded-xl border px-3 py-2 transition ${editForm.forLiquidity ? 'border-sky-600 bg-sky-50' : 'border-edge'}`}>
                <p className="text-sm font-medium">Liquidity savings</p>
              </button>
            </div>
          </div>
          <ScopeFields
            scope={editForm.scope}
            year={editForm.goalYear}
            recurringYearly={editForm.recurringYearly}
            onScopeChange={(scope) => setEditForm((f) => ({
              ...f,
              scope,
              goalYear: scope === 'year' ? (f.goalYear || CURRENT_YEAR) : f.goalYear,
              recurringYearly: scope === 'year' ? f.recurringYearly : false,
            }))}
            onYearChange={(goalYear) => setEditForm((f) => ({ ...f, goalYear }))}
            onRecurringChange={(recurringYearly) => setEditForm((f) => ({ ...f, recurringYearly }))}
          />
          <TagField
            value={editForm.tags || []}
            onChange={(tags) => setEditForm((f) => ({ ...f, tags }))}
            suggestions={knownTags}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-ink-soft mb-1">{editForm.forLiquidity ? 'Amount to keep available (₹)' : 'Value today (₹)'}<span className="text-danger ml-0.5">*</span></label>
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
          {!editForm.forLiquidity && (
            <div>
              <label className="block text-xs text-ink-soft mb-1">Target date <span className="text-danger ml-0.5">*</span></label>
              <input type="date" value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                className="field-input"/>
            </div>
          )}
          {editForm.forLiquidity && Number(editForm.amount) > 0 && (
            <p className="text-[11px] text-ink-soft">Inflation raises this buffer over time. There is no end date, so no daily or monthly pace.</p>
          )}
          {!editForm.forLiquidity && Number(editForm.amount) > 0 && editForm.date && (
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
        <div className={`relative z-[1] goal-on-water ${compact ? 'px-3 py-2.5' : ''}`}>
          {compact ? (
            <div className="flex items-center gap-3">
              <DragHandle onDragStart={onDragStart} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{g.name}</span>
                  {liquidity ? <GoalAttrTag>Liquidity</GoalAttrTag> : null}
                  {recurring ? <GoalAttrTag>Yearly</GoalAttrTag> : null}
                </div>
                <p className="text-[11px] text-ink-mute mt-0.5 truncate">
                  {inr(cur)} of {inr(tgt)}
                </p>
                <p className="text-[11px] text-ink-mute mt-0.5 truncate">{goalTargetLabel(g, liquidity)}</p>
                <TagList tags={g.tags} className="mt-1.5" />
              </div>
              <div className="w-16 h-1.5 bg-paper-tint rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span ref={originRef} className={`text-sm font-medium w-10 text-right flex-shrink-0 ${reached ? 'achieved-amount' : ''}`}>{pct}%</span>
            </div>
          ) : (
            <>
          <div className="flex justify-between items-start mb-2.5">
            <DragHandle onDragStart={onDragStart} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{g.name}</span>
                {liquidity ? <GoalAttrTag>Liquidity</GoalAttrTag> : null}
                {recurring ? <GoalAttrTag>Yearly</GoalAttrTag> : null}
                {nearGoal && <span className="pulse-soft text-[10px] bg-mint-50 text-mint-700 px-1.5 py-0.5 rounded-full">near goal</span>}
                {reached && <span className="text-[10px] bg-mint-600 text-paper px-1.5 py-0.5 rounded-full">reached! 👏</span>}
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {inr(cur)} of {inr(tgt)}
                <> · {g.investment_count} {g.investment_count == 1 ? 'investment' : 'investments'}</>
              </p>
              <p className="text-[11px] text-ink-mute mt-1">{goalTargetLabel(g, liquidity)}</p>
              <TagList tags={g.tags} className="mt-1.5" />
            </div>
            <div ref={originRef} className="text-right ml-3 flex-shrink-0">
              <span className={`text-sm font-medium ${reached ? 'achieved-amount' : ''}`}>{pct}%</span>
            </div>
          </div>
          <div className="h-2 bg-paper-tint rounded-full overflow-hidden">
            <div className="fill-bar h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
            </>
          )}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-edge space-y-2">
              {hasDescription && (
                <div className="rounded-lg bg-paper-tint border border-edge px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-soft mb-1">Details</p>
                  <p className="text-xs text-ink">{g.description}</p>
                </div>
              )}
              {liquidity && (
                <div className="rounded-lg border border-sky-600/30 bg-sky-50 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-sky-600 mb-1">Liquidity buffer</p>
                  <p className="text-[11px] text-ink-soft">
                    Set at {inr(g.target_amount)}
                    {Number(g.inflation_pct) > 0 ? ` · ${Number(g.inflation_pct)}% inflation` : ''}
                    {Number(g.required_amount) > Number(g.target_amount) ? ` · now ${inr(g.required_amount)}` : ''}
                    . No end date.
                  </p>
                </div>
              )}
              {!liquidity && g.target_date && (
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
          {(!compact || isExpanded) && (
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
          )}
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
  const [editForm, setEditForm] = useState({
    name: '', description: '', amount: '', inflationPct: '0', date: '', icon: 'house',
    forLiquidity: false, amountAsOf: '', baseAmount: '', scope: 'common', goalYear: CURRENT_YEAR,
    recurringYearly: false, tags: [],
  });
  const [knownTags, setKnownTags] = useState([]);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [layout, setLayout] = useState('list');
  const [draggingId, setDraggingId] = useState(null);
  const [draggingSection, setDraggingSection] = useState(null);
  const [orderError, setOrderError] = useState('');

  const { commonGoals, currentYearGoals, pastYearStats, futureGoalGroups } = useMemo(() => {
    const common = [];
    const current = [];
    const pastByYear = new Map();
    const futureGoalsByYear = new Map();

    const bump = (map, year, status) => {
      if (!map.has(year)) {
        map.set(year, { year, completed: 0, pending: 0, not_yet: 0, total: 0 });
      }
      const bucket = map.get(year);
      bucket[status] += 1;
      bucket.total += 1;
    };

    for (const goal of goals) {
      const year = goalScopeYear(goal);
      if (isCommonGoal(goal)) {
        common.push(goal);
        continue;
      }
      if (year === CURRENT_YEAR) {
        current.push(goal);
        continue;
      }
      if (year != null && year < CURRENT_YEAR) {
        bump(pastByYear, year, goalOutcomeStatus(goal));
      } else if (year != null && year > CURRENT_YEAR) {
        if (!futureGoalsByYear.has(year)) futureGoalsByYear.set(year, []);
        futureGoalsByYear.get(year).push(goal);
      }
    }

    return {
      commonGoals: common,
      currentYearGoals: current,
      pastYearStats: Array.from(pastByYear.values()).sort((a, b) => b.year - a.year),
      futureGoalGroups: Array.from(futureGoalsByYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, items]) => ({ year, goals: items })),
    };
  }, [goals]);

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

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setKnownTags(Array.isArray(data.tags) ? data.tags : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('goals-layout');
    if (stored === 'tiles' || stored === 'list') setLayout(stored);
  }, []);

  const chooseLayout = (next) => {
    setLayout(next);
    window.localStorage.setItem('goals-layout', next);
  };

  const openEdit = (e, g) => {
    e.stopPropagation();
    const year = goalScopeYear(g);
    setEditId(g.id);
    setEditForm({
      name: g.name,
      description: g.description || '',
      amount: String(g.target_amount),
      inflationPct: String(g.inflation_pct ?? 0),
      date: g.target_date ? String(g.target_date).slice(0, 10) : '',
      icon: g.icon || 'house',
      forLiquidity: isLiquidityGoal(g),
      amountAsOf: g.amount_as_of ? String(g.amount_as_of).slice(0, 10) : '',
      baseAmount: String(g.target_amount),
      scope: year == null ? 'common' : 'year',
      goalYear: year || CURRENT_YEAR,
      recurringYearly: year != null && isRecurringYearlyGoal(g),
      tags: investmentTags(g).map((tag) => tag.name),
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
    if (!editForm.forLiquidity && !editForm.date) { setEditError('Target date is required.'); return; }
    if (Number(editForm.inflationPct) < 0) { setEditError('Inflation percentage must be zero or more.'); return; }
    const projectedAmount = editForm.forLiquidity
      ? Number(editForm.amount)
      : computeProjectedGoal(editForm.amount, editForm.inflationPct, editForm.date);
    const amountUnchanged = Math.abs(Number(editForm.amount) - Number(editForm.baseAmount)) < 0.01;
    const amountAsOf = editForm.forLiquidity
      ? (amountUnchanged && editForm.amountAsOf ? editForm.amountAsOf : new Date().toISOString().slice(0, 10))
      : null;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          target_amount: Number(projectedAmount.toFixed(2)),
          target_date: editForm.forLiquidity ? null : editForm.date,
          inflation_pct: Number(editForm.inflationPct) || 0,
          for_liquidity: editForm.forLiquidity,
          amount_as_of: amountAsOf,
          icon: editForm.icon,
          goal_year: editForm.scope === 'year' ? Number(editForm.goalYear) : null,
          recurring_yearly: editForm.scope === 'year' ? !!editForm.recurringYearly : false,
          tags: editForm.tags || [],
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

  const persistGoalOrder = async (next) => {
    setGoals(next);
    setOrderError('');
    try {
      const res = await fetch('/api/goals/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((goal) => goal.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the new order.');
    } catch (err) {
      setOrderError(err.message);
      load();
    }
  };

  const onGoalDragStart = (e, id, section) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('application/x-goal-section', section);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
    setDraggingSection(section);
  };

  const onGoalDrop = async (e, targetId, section, sectionGoals) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    const sourceSection = e.dataTransfer.getData('application/x-goal-section') || draggingSection;
    setDraggingId(null);
    setDraggingSection(null);
    if (!sourceId || sourceId === targetId) return;
    if (sourceSection !== section) return;

    const nextSection = moveItem(sectionGoals, sourceId, targetId);
    const sectionKey = String(section);
    let next;

    if (sectionKey === 'common') {
      next = [
        ...nextSection,
        ...currentYearGoals,
        ...goals.filter((goal) => {
          const year = goalScopeYear(goal);
          return year != null && year !== CURRENT_YEAR;
        }),
      ];
    } else if (sectionKey === 'current') {
      next = [
        ...commonGoals,
        ...nextSection,
        ...goals.filter((goal) => {
          const year = goalScopeYear(goal);
          return year != null && year !== CURRENT_YEAR;
        }),
      ];
    } else if (sectionKey.startsWith('future-')) {
      const year = Number(sectionKey.slice('future-'.length));
      next = [];
      let inserted = false;
      for (const goal of goals) {
        if (goalScopeYear(goal) === year) {
          if (!inserted) {
            next.push(...nextSection);
            inserted = true;
          }
          continue;
        }
        next.push(goal);
      }
      if (!inserted) next.push(...nextSection);
    } else {
      return;
    }

    await persistGoalOrder(next);
  };

  const renderGoalList = (sectionGoals, section) => {
    if (sectionGoals.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-edge bg-paper-tint/60 px-4 py-8 text-center">
          <p className="text-sm text-ink-soft">
            {section === 'common'
              ? 'No life goals yet.'
              : section === 'current'
                ? `No ${CURRENT_YEAR} goals yet.`
                : 'No goals in this year yet.'}
          </p>
          <Link href="/goals/new" className="inline-block mt-3 text-xs font-medium text-mint-700 hover:underline">
            + Add one
          </Link>
        </div>
      );
    }

    return (
      <div className={layout === 'tiles' ? 'grid grid-cols-1 gap-3 items-start' : ''}>
        {sectionGoals.map((g, idx) => (
          <div
            key={g.id}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => onGoalDrop(e, g.id, section, sectionGoals)}
            className={`${draggingId === g.id ? 'opacity-60' : ''}`}
          >
            <GoalCard
              goal={g}
              idx={idx}
              layout={layout}
              onDragStart={(e) => onGoalDragStart(e, g.id, section)}
              investments={investmentsByGoal[g.id] || []}
              isEditing={editId === g.id}
              isExpanded={expandedGoalId === g.id}
              editForm={editForm}
              setEditForm={setEditForm}
              knownTags={knownTags}
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
          </div>
        ))}
      </div>
    );
  };

  const onDelete = async (e, id) => {
    e.stopPropagation();
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    load();
  };

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 mx-auto w-full relative min-h-full max-w-6xl">

        <div className="flex justify-between items-end mb-5 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Goals</h1>
            <p className="text-sm text-ink-soft mt-1">Small steps today — the goals you fund become the life you build.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LayoutToggle value={layout} onChange={chooseLayout} />
            <Link href="/goals/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium whitespace-nowrap">+ New goal</Link>
          </div>
        </div>

        {loading && <div className="h-20 bg-paper-tint rounded-xl animate-pulse" />}
        {!loading && loadError && <p className="text-sm text-danger mb-3">{loadError}</p>}
        {orderError && <p className="text-sm text-danger mb-3">{orderError}</p>}

        {!loading && !loadError && (
          <>
            {(commonGoals.length > 0 || currentYearGoals.length > 0) && (
              <p className="text-[11px] text-ink-mute mb-3">Drag the handle within a column to set priority.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-start">
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h2 className="text-base font-medium tracking-tight">Life goal</h2>
                  <span className="text-[11px] text-ink-mute">{commonGoals.length}</span>
                </div>
                {renderGoalList(commonGoals, 'common')}
              </section>
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h2 className="text-base font-medium tracking-tight">{CURRENT_YEAR}</h2>
                  <span className="text-[11px] text-ink-mute">{currentYearGoals.length}</span>
                </div>
                {renderGoalList(currentYearGoals, 'current')}
              </section>
            </div>
            <YearStatsChart title="Past years" rows={pastYearStats} />
            {futureGoalGroups.length > 0 && (
              <section className="mt-8 pt-6 border-t border-edge space-y-5">
                <div>
                  <h2 className="text-lg font-medium tracking-tight">Future years</h2>
                  <p className="text-sm text-ink-soft mt-1">Goals planned ahead — still in the same list or tiles view</p>
                </div>
                {futureGoalGroups.map(({ year, goals: yearGoals }) => (
                  <div key={year} className="rounded-2xl border border-edge bg-paper-tint/50 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-8 w-1 rounded-full bg-mint-600 flex-shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <h3 className="text-base font-medium tracking-tight tabular-nums">{year}</h3>
                          <p className="text-[11px] text-ink-mute">Coming up</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-paper-card border border-edge text-ink-soft flex-shrink-0">
                        {yearGoals.length} {yearGoals.length === 1 ? 'goal' : 'goals'}
                      </span>
                    </div>
                    {renderGoalList(yearGoals, `future-${year}`)}
                  </div>
                ))}
              </section>
            )}
          </>
        )}

      </div>
    </Shell>
  );
}
