'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Shell from '@/components/Shell';

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

const computeSavingsPace = (amount, targetDate) => {
  const total = Number(amount) || 0;
  if (!total || !targetDate) return { daily: 0, monthly: 0 };
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return { daily: 0, monthly: 0 };
  const days = Math.max(1, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const daily = total / days;
  const monthly = total / Math.max(1, Math.ceil(days / 30));
  return { daily, monthly };
};

export default function NewGoalClient({ user }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [inflationPct, setInflationPct] = useState('6');
  const [date, setDate] = useState('');
  const [forLiquidity, setForLiquidity] = useState(false);
  const [icon, setIcon] = useState('house');
  const [otherLabel, setOtherLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const projectedGoalAmount = computeProjectedGoal(amount, inflationPct, date);
  const savingsPace = computeSavingsPace(projectedGoalAmount, date);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Tell us what you are saving for.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a value greater than zero.'); return; }
    if (!forLiquidity && !date) { setError('Target date is required.'); return; }
    if (Number(inflationPct) < 0) { setError('Inflation percentage must be zero or more.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          target_amount: Number((forLiquidity ? Number(amount) : projectedGoalAmount).toFixed(2)),
          target_date: forLiquidity ? null : date,
          inflation_pct: Number(inflationPct) || 0,
          for_liquidity: forLiquidity,
          amount_as_of: forLiquidity ? new Date().toISOString().slice(0, 10) : null,
          icon,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create goal.');
      router.push('/goals');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-xl mx-auto w-full">
        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Cancel</button>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-1">New goal</h1>
        <p className="text-sm text-ink-soft mb-6">Required fields marked with *</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2.5">Purpose</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForLiquidity(false)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${!forLiquidity ? 'border-mint-600 bg-mint-50' : 'border-edge bg-paper-card hover:border-mint-600'}`}
              >
                <p className="text-sm font-medium">Goal with a date</p>
                <p className="text-[11px] text-ink-soft mt-0.5">A target you want to reach by a chosen day.</p>
              </button>
              <button
                type="button"
                onClick={() => setForLiquidity(true)}
                className={`text-left rounded-xl border px-3 py-2.5 transition ${forLiquidity ? 'border-sky-600 bg-sky-50' : 'border-edge bg-paper-card hover:border-sky-600'}`}
              >
                <p className="text-sm font-medium">Liquidity savings</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Cash to keep available. Inflation applies. No end date.</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">{forLiquidity ? 'What is this buffer for?' : 'What are you saving for?'}<span className="text-danger ml-0.5">*</span></label>
            <input type="text" autoFocus placeholder={forLiquidity ? 'e.g. Emergency fund' : 'e.g. Car, Wedding, Vacation'}
              value={name} onChange={(e) => setName(e.target.value)} className="field-input"/>
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">Description</label>
            <textarea rows={3} placeholder="Add important details like venue, budget notes, or milestones."
              value={description} onChange={(e) => setDescription(e.target.value)} className="field-input resize-none" />
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">{forLiquidity ? 'Amount to keep available (₹)' : 'Value today (₹)'}<span className="text-danger ml-0.5">*</span></label>
            <input type="number" inputMode="numeric" placeholder="500000"
              value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input"/>
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">Inflation (%)</label>
            <input type="number" step="0.1" min="0" placeholder="6"
              value={inflationPct} onChange={(e) => setInflationPct(e.target.value)} className="field-input"/>
          </div>

          {!forLiquidity && (
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">
                Target date <span className="text-danger ml-0.5">*</span>
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input"/>
              <p className="text-[11px] text-ink-mute mt-1">This date is used to project the future goal amount.</p>
            </div>
          )}

          {forLiquidity && Number(amount) > 0 && (
            <div className="rounded-xl border border-sky-600/30 bg-sky-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-sky-600 mb-1">Buffer to keep available</p>
              <p className="text-lg font-medium text-ink">₹{Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-ink-soft mt-1">
                {Number(inflationPct) > 0
                  ? `At ${Number(inflationPct)}% inflation this is about ₹${Number(Number(amount) * Math.pow(1 + Number(inflationPct) / 100, 1)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} in one year. There is no end date.`
                  : 'This stays at the amount you enter. There is no end date.'}
              </p>
            </div>
          )}

          {!forLiquidity && Number(amount) > 0 && date && (
            <div className="rounded-xl border border-mint-200 bg-mint-50 px-3 py-2 space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-mint-700 mb-1">Expected goal amount based on target date</p>
                <p className="text-lg font-medium text-mint-800">₹{Number(projectedGoalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-mint-800">
                <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(savingsPace.daily).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/day</span>
                <span className="bg-white/70 border border-mint-200 rounded-full px-2 py-1">₹{Number(savingsPace.monthly).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-ink-soft mb-2">Pick an icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`chip capitalize ${icon === ic ? 'on' : ''}`}>{ic}</button>
              ))}
            </div>
            {icon === 'other' && (
              <div className="mt-3">
                <label className="block text-xs text-ink-soft mb-1.5">Describe your goal<span className="text-danger ml-0.5">*</span></label>
                <input type="text" autoFocus placeholder="e.g. Home renovation, Emergency fund…"
                  value={otherLabel} onChange={(e) => { setOtherLabel(e.target.value); setName(e.target.value); }} className="field-input"/>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2.5 pt-3 border-t border-edge">
            <button type="button" onClick={() => router.back()} className="btn-ghost py-2.5 px-5 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 rounded-lg text-sm font-medium">
              {saving ? 'Creating…' : 'Create goal'}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
