'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate } from '@/lib/format';

const FILL_COLORS = ['#0F6E56', '#185FA5', '#993C1D', '#854F0B', '#3C3489', '#72243E'];
const ICONS = ['house', 'car', 'education', 'travel', 'wedding', 'other'];

export default function GoalsClient({ user }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', amount: '', date: '', icon: 'house' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const hostRef = useRef(null);

  const load = () => {
    fetch('/api/goals').then(r => r.json()).then(d => {
      setGoals(d.goals || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const celebrate = (e, pct) => {
    const target = e.currentTarget.getBoundingClientRect();
    const host = hostRef.current.getBoundingClientRect();
    const cx = target.left - host.left + target.width / 2;
    const cy = target.top - host.top + target.height / 2;
    const colors = ['#EF9F27', '#5DCAA5', '#7F77DD', '#D4537E', '#185FA5'];
    const n = pct >= 90 ? 22 : 14;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('span');
      dot.className = 'spark';
      dot.style.background = colors[i % colors.length];
      dot.style.left = cx + 'px';
      dot.style.top = cy + 'px';
      const ang = (Math.PI * 2) * (i / n);
      const dist = 60 + Math.random() * 40;
      dot.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
      dot.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
      hostRef.current.appendChild(dot);
      setTimeout(() => dot.remove(), 900);
    }
  };

  const openEdit = (e, g) => {
    e.stopPropagation();
    setEditId(g.id);
    setEditForm({
      name: g.name,
      amount: String(g.target_amount),
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
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError('Enter a valid target amount.'); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          target_amount: Number(editForm.amount),
          target_date: editForm.date || null,
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
      <div ref={hostRef} className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full relative min-h-full">

        <div className="flex justify-between items-end mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Goals</h1>
            <p className="text-sm text-ink-soft mt-1">tap any goal to celebrate progress</p>
          </div>
          <Link href="/goals/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium">+ New goal</Link>
        </div>

        {loading && <div className="h-20 bg-paper-tint rounded-xl animate-pulse" />}

        {!loading && goals.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-full bg-mint-50 text-mint-600 flex items-center justify-center text-2xl font-light mb-3">+</div>
            <p className="text-base font-medium mb-1">No goals yet</p>
            <p className="text-sm text-ink-soft mb-5">Set your first goal to start tracking progress.</p>
            <Link href="/goals/new" className="btn-primary py-2.5 px-5 rounded-lg text-sm font-medium inline-block">Create a goal</Link>
          </div>
        )}

        {!loading && goals.map((g, idx) => {
          const cur = Number(g.current_amount || 0);
          const tgt = Number(g.target_amount || 1);
          const pct = Math.min(100, Math.round((cur / tgt) * 100));
          const color = FILL_COLORS[idx % FILL_COLORS.length];
          const nearGoal = pct >= 85;
          const isEditing = editId === g.id;

          return (
            <div key={g.id}
              onClick={isEditing ? undefined : (e) => celebrate(e, pct)}
              className={`bg-paper-card border border-edge rounded-2xl p-4 mb-3 transition ${isEditing ? 'border-mint-600' : 'cursor-pointer hover:border-mint-600'}`}>

              {isEditing ? (
                <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                  <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-1">Edit goal</p>
                  <div>
                    <label className="block text-xs text-ink-soft mb-1">Goal name<span className="text-danger ml-0.5">*</span></label>
                    <input type="text" autoFocus value={editForm.name}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="field-input"/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-ink-soft mb-1">Target amount (₹)<span className="text-danger ml-0.5">*</span></label>
                      <input type="number" inputMode="numeric" value={editForm.amount}
                        onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="field-input"/>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-soft mb-1">Target date <span className="text-[10px] text-ink-mute">optional</span></label>
                      <input type="date" value={editForm.date}
                        onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))}
                        className="field-input"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-ink-soft mb-1.5">Icon</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ICONS.map((ic) => (
                        <button key={ic} type="button"
                          onClick={() => setEditForm(f => ({ ...f, icon: ic }))}
                          className={`chip capitalize text-[11px] py-1 ${editForm.icon === ic ? 'on' : ''}`}>{ic}</button>
                      ))}
                    </div>
                  </div>
                  {editError && <p className="text-xs text-danger">{editError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={cancelEdit}
                      className="btn-ghost py-1.5 px-4 rounded-lg text-xs">Cancel</button>
                    <button type="button" disabled={editSaving} onClick={(e) => saveEdit(e, g.id)}
                      className="btn-primary flex-1 py-1.5 rounded-lg text-xs font-medium">
                      {editSaving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{g.name}</span>
                        {nearGoal && pct < 100 && <span className="pulse-soft text-[10px] bg-mint-50 text-mint-700 px-1.5 py-0.5 rounded-full">near goal</span>}
                        {pct >= 100 && <span className="text-[10px] bg-mint-600 text-paper px-1.5 py-0.5 rounded-full">reached!</span>}
                      </div>
                      <p className="text-xs text-ink-soft mt-1">
                        {inr(cur)} of {inr(tgt)}
                        {g.target_date && <> · target {fmtDate(g.target_date)}</>}
                        <> · {g.investment_count} {g.investment_count == 1 ? 'investment' : 'investments'}</>
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <span className="text-sm font-medium">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-paper-tint rounded-full overflow-hidden">
                    <div className="fill-bar h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex justify-end items-center gap-3 mt-2">
                    <button onClick={(e) => openEdit(e, g)}
                      className="text-[11px] text-ink-mute hover:text-mint-600">edit</button>
                    {confirmDeleteId === g.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px] text-ink-soft">Sure?</span>
                        <button onClick={(e) => onDelete(e, g.id)}
                          className="text-[11px] text-danger font-medium">Yes</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          className="text-[11px] text-ink-mute">No</button>
                      </span>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(g.id); }}
                        className="text-[11px] text-ink-mute hover:text-danger">delete</button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

      </div>
    </Shell>
  );
}
