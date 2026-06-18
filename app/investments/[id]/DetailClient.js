'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, labelFor, frequencyLabel } from '@/lib/format';

// Generate expected payment schedule for a recurring investment.
function buildSchedule(investment) {
  const freq = investment.payment_frequency;
  if (freq !== 'monthly' && freq !== 'yearly') return [];

  const start = new Date(investment.start_date);
  const tenureMonths = Number(investment.tenure_months);
  const amount = Number(investment.amount);
  const schedule = [];

  if (freq === 'monthly') {
    for (let m = 0; m < tenureMonths; m++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + m);
      // Use Intl for locale-aware short month name.
      const label = due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      schedule.push({ period_label: label, due_date: due.toISOString().slice(0,10), amount });
    }
  } else {
    const years = Math.floor(tenureMonths / 12);
    for (let y = 0; y < years; y++) {
      const due = new Date(start);
      due.setFullYear(due.getFullYear() + y);
      const startYr = due.getFullYear();
      const label = `${startYr}-${String(startYr + 1).slice(2)}`;
      schedule.push({ period_label: label, due_date: due.toISOString().slice(0,10), amount });
    }
  }
  return schedule;
}

// Returns a short month label using Intl.DateTimeFormat (e.g. 'Jun 2026').
// (Consumed inline in buildSchedule above.)

// Returns days until maturity (negative if already past). Returns null if no maturity date.
function daysUntilMaturity(maturityDate) {
  if (!maturityDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mat = new Date(maturityDate);
  mat.setHours(0, 0, 0, 0);
  return Math.round((mat - today) / (1000 * 60 * 60 * 24));
}

export default function DetailClient({ user, investment: i, documents }) {
  const router = useRouter();
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Payment records state
  const [paymentRecords, setPaymentRecords] = useState({});
  const [togglingPeriod, setTogglingPeriod] = useState(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsWritable, setPaymentsWritable] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');

  const freq = i.payment_frequency || 'lump_sum';
  const isRecurring = freq === 'monthly' || freq === 'yearly';

  const onDelete = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/investments/${i.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      router.push('/investments');
      router.refresh();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  // Load payment records for recurring investments.
  useEffect(() => {
    if (!isRecurring) return;
    setPaymentsError('');
    fetch(`/api/investments/${i.id}/payments`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load payment history.');
        return d;
      })
      .then(d => {
        const map = {};
        (d.records || []).forEach(r => { map[r.period_label] = r; });
        setPaymentRecords(map);
        setPaymentsWritable(d.writable !== false);
        if (d.warning) setPaymentsError(d.warning);
      })
      .catch((err) => {
        setPaymentsError(err.message || 'Could not load payment history.');
      })
      .finally(() => setPaymentsLoaded(true));
  }, [i.id, isRecurring]);

  const togglePayment = async (slot) => {
    setPaymentsError('');
    setTogglingPeriod(slot.period_label);
    const current = paymentRecords[slot.period_label];
    const newPaid = !(current?.paid);
    try {
      const res = await fetch(`/api/investments/${i.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slot, paid: newPaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update payment record.');
      setPaymentRecords(prev => ({ ...prev, [slot.period_label]: data.record }));
    } catch (err) {
      setPaymentsError(err.message || 'Could not update payment record.');
    } finally {
      setTogglingPeriod(null);
    }
  };

  const monthlyInt = (Number(i.amount) * Number(i.rate_pct)) / 100 / 12;
  const monthlyPct = (Number(i.rate_pct) / 12).toFixed(3);

  // Total invested for periodic types
  let totalInvested = Number(i.amount);
  if (freq === 'monthly' && i.tenure_months) {
    totalInvested = Number(i.amount) * Number(i.tenure_months);
  } else if (freq === 'yearly' && i.tenure_months) {
    totalInvested = Number(i.amount) * Math.floor(Number(i.tenure_months) / 12);
  }

  const amountLabel = freq === 'monthly' ? 'Monthly contribution' : freq === 'yearly' ? 'Yearly contribution' : 'Amount';
  const freqSuffix = freq === 'monthly' ? '/mo' : freq === 'yearly' ? '/yr' : '';

  // Maturity warning
  const daysLeft = daysUntilMaturity(i.maturity_date);
  const maturityUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const maturityWarning = daysLeft !== null && daysLeft >= 0 && daysLeft <= 90 && !maturityUrgent;

  // Payment schedule
  const schedule = isRecurring ? buildSchedule(i) : [];
  const paidCount = schedule.filter(s => paymentRecords[s.period_label]?.paid).length;
  const totalPaid = paidCount * Number(i.amount);
  const expectedPaid = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedule.filter(s => new Date(s.due_date) <= today).length;
  })();

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full">

        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Back</button>

        {/* Maturity urgency banner */}
        {(maturityUrgent || maturityWarning) && (
          <div className={`flex items-start gap-3 rounded-xl p-3.5 mb-4 ${maturityUrgent ? 'bg-danger-soft border border-danger/30' : 'bg-honey-50 border border-honey-600/30'}`}>
            <span className="text-xl leading-none">{maturityUrgent ? '🔔' : '📅'}</span>
            <div>
              <p className={`text-sm font-medium ${maturityUrgent ? 'text-danger' : 'text-honey-600'}`}>
                {maturityUrgent
                  ? `Matures in ${daysLeft} day${daysLeft === 1 ? '' : 's'}!`
                  : `Matures in ${daysLeft} days`}
              </p>
              <p className="text-[11px] text-ink-soft mt-0.5">
                {maturityUrgent
                  ? 'This investment is about to mature. Plan your next steps — renew, withdraw, or reinvest.'
                  : 'This investment is maturing soon. Consider your renewal or withdrawal options.'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-paper-tint rounded-2xl p-5 mb-5">
          <p className="text-[11px] tracking-wider text-ink-mute uppercase">{labelFor(i)}</p>
          {isRecurring ? (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">
                {inr(i.amount)}<span className="text-base text-ink-soft font-normal">{freqSuffix}</span>
              </p>
              <p className="text-sm text-ink-soft mt-1">Total invested: <span className="font-medium text-ink">{inr(totalInvested)}</span></p>
              <p className="text-sm text-ink-soft mt-1">
                Matures to <span className="text-mint-600 font-medium">{inr(i.maturity_value || totalInvested)}</span>
                {i.maturity_date && <> on {fmtDate(i.maturity_date)}</>}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(i.amount)}</p>
              <p className="text-sm text-ink-soft mt-2">
                Matures to <span className="text-mint-600 font-medium">{inr(i.maturity_value || i.amount)}</span>
                {i.maturity_date && <> on {fmtDate(i.maturity_date)}</>}
              </p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 mb-5">
          <Row label="Bank" value={i.bank} />
          <Row label="Plan" value={i.plan_name} />
          <Row label={amountLabel} value={`${inr(i.amount)}${freqSuffix}`} />
          {isRecurring && <Row label="Total invested" value={inr(totalInvested)} />}
          <Row label="Rate" value={`${i.rate_pct}% p.a. (≈ ${monthlyPct}%/mo)`} />
          {!isRecurring && <Row label="Monthly interest" value={<span className="text-mint-600">{inr(monthlyInt)}</span>} />}
          <Row label="Payment frequency" value={frequencyLabel(freq)} />
          <Row label="Tenure" value={`${i.tenure_months} months${i.tenure_days ? ` ${i.tenure_days} days` : ''}`} />
          <Row label="Started" value={fmtDate(i.start_date)} />
          <Row label="Goal" value={i.goal_name ? <Link href="/goals" className="text-sky-600">{i.goal_name} →</Link> : '—'} />
          <Row label="Nominee" value={i.nominee} />
          <Row label="Account holder" value={i.account_holder || 'Self'} />
          <Row label="Auto-renew" value={i.auto_renew ? <span className="text-mint-600">on · reminder 30d before</span> : 'off'} />
        </div>

        {/* Payment records section for recurring investments */}
        {isRecurring && (
          <section className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Payment history</p>
              {paymentsLoaded && (
                <span className="text-[11px] text-ink-soft">
                  {paidCount}/{schedule.length} paid · {inr(totalPaid)} of {inr(Number(i.amount) * schedule.length)}
                  {expectedPaid > 0 && paidCount < expectedPaid && (
                    <span className="ml-1.5 text-danger font-medium">{expectedPaid - paidCount} overdue</span>
                  )}
                </span>
              )}
            </div>
            {paymentsError && (
              <p role="alert" aria-live="polite" className="text-[11px] text-danger mb-2">{paymentsError}</p>
            )}
            {!paymentsLoaded ? (
              <div className="space-y-1.5">
                {[0,1,2].map(n => <div key={n} className="h-10 bg-paper-tint rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
                {schedule.map((slot, idx) => {
                  const record = paymentRecords[slot.period_label];
                  const paid = record?.paid;
                  const today = new Date(); today.setHours(0,0,0,0);
                  const isDue = new Date(slot.due_date) <= today;
                  const isToggling = togglingPeriod === slot.period_label;
                  return (
                    <div key={slot.period_label}
                      className={`flex items-center gap-3 px-3.5 py-2.5 ${idx > 0 ? 'border-t border-edge' : ''} ${!paid && isDue ? 'bg-danger-soft/30' : ''}`}>
                      <button
                        onClick={() => togglePayment(slot)}
                        disabled={isToggling || !paymentsWritable}
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                          ${paid ? 'bg-mint-600 border-mint-600' : 'border-edge hover:border-mint-600'}
                          ${!paymentsWritable ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {paid && <span className="text-white text-[10px] font-bold">✓</span>}
                        {isToggling && <span className="text-ink-mute text-[9px]">…</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{slot.period_label}</p>
                        <p className="text-[11px] text-ink-mute">{fmtDate(slot.due_date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium">{inr(slot.amount)}</p>
                        {paid ? (
                          <p className="text-[11px] text-mint-600">Paid{record.paid_at ? ` · ${fmtDate(record.paid_at)}` : ''}</p>
                        ) : isDue ? (
                          <p className="text-[11px] text-danger">Overdue</p>
                        ) : (
                          <p className="text-[11px] text-ink-mute">Upcoming</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {documents.length > 0 && (
          <section className="mb-5">
            <p className="text-[11px] tracking-wider text-ink-mute uppercase mb-2">Documents</p>
            {documents.map((d) => (
              <button key={d.id} onClick={() => setViewing(d)}
                className="w-full flex items-center gap-3 p-3 bg-paper-card border border-edge rounded-xl mb-2 hover:border-mint-600 transition text-left">
                <div className="w-7 h-9 bg-danger-soft text-danger rounded text-[10px] font-medium flex items-center justify-center flex-shrink-0">PDF</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-[11px] text-ink-mute">{(d.size_bytes / 1024).toFixed(0)} KB · tap to view</p>
                </div>
                <span className="text-ink-mute text-sm">›</span>
              </button>
            ))}
          </section>
        )}

        <div className="flex items-center gap-3 pt-3 border-t border-edge flex-wrap">
          <Link href={`/investments/${i.id}/edit`} className="btn-ghost py-2 px-4 rounded-lg text-sm">
            Edit investment
          </Link>
          {confirmDelete ? (
            <>
              <span className="text-sm text-ink-soft">Delete this investment? This cannot be undone.</span>
              <button onClick={onDelete} disabled={deleting} className="text-sm text-danger font-medium px-3 py-1.5 rounded-lg border border-danger hover:bg-danger-soft transition disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-mute px-3 py-1.5 rounded-lg border border-edge hover:bg-paper-tint transition">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm text-danger px-4 py-2 hover:underline">Delete investment</button>
          )}
        </div>
        {deleteError && <p className="text-xs text-danger mt-2">{deleteError}</p>}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex flex-col anim-fade" onClick={() => setViewing(null)}>
          <div className="bg-paper-card border-b border-edge px-4 py-3 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-medium truncate">{viewing.filename}</span>
            <button onClick={() => setViewing(null)} className="text-2xl leading-none px-2 text-ink-soft">×</button>
          </div>
          <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
            <iframe src={viewing.data_url} className="w-full h-full bg-white rounded" title={viewing.filename}/>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-dashed border-edge text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
