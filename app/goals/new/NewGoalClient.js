'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Shell from '@/components/Shell';

const ICONS = ['house', 'car', 'education', 'travel', 'wedding', 'other'];

export default function NewGoalClient({ user }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [icon, setIcon] = useState('house');
  const [otherLabel, setOtherLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Tell us what you are saving for.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a target amount greater than zero.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          target_amount: Number(amount),
          target_date: date || null,
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
            <label className="block text-xs text-ink-soft mb-1.5">What are you saving for?<span className="text-danger ml-0.5">*</span></label>
            <input type="text" autoFocus placeholder="e.g. Car, Wedding, Vacation"
              value={name} onChange={(e) => setName(e.target.value)} className="field-input"/>
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">Target amount (₹)<span className="text-danger ml-0.5">*</span></label>
            <input type="number" inputMode="numeric" placeholder="500000"
              value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input"/>
          </div>

          <div>
            <label className="block text-xs text-ink-soft mb-1.5">
              Target date <span className="text-[10px] text-ink-mute ml-1">optional</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input"/>
            <p className="text-[11px] text-ink-mute mt-1">Skip if you don't have a deadline in mind.</p>
          </div>

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
