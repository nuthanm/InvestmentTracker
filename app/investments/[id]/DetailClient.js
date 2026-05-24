'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, labelFor } from '@/lib/format';

export default function DetailClient({ user, investment: i, documents }) {
  const router = useRouter();
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const monthlyInt = (Number(i.amount) * Number(i.rate_pct)) / 100 / 12;
  const monthlyPct = (Number(i.rate_pct) / 12).toFixed(3);

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-3xl mx-auto w-full">

        <button onClick={() => router.back()} className="text-xs text-ink-soft mb-4">← Back</button>

        <div className="bg-paper-tint rounded-2xl p-5 mb-5">
          <p className="text-[11px] tracking-wider text-ink-mute uppercase">{labelFor(i)}</p>
          <p className="text-2xl md:text-3xl font-medium tracking-tight mt-1">{inr(i.amount)}</p>
          <p className="text-sm text-ink-soft mt-2">
            Matures to <span className="text-mint-600 font-medium">{inr(i.maturity_value || i.amount)}</span>
            {i.maturity_date && <> on {fmtDate(i.maturity_date)}</>}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 mb-5">
          <Row label="Bank" value={i.bank} />
          <Row label="Plan" value={i.plan_name} />
          <Row label="Rate" value={`${i.rate_pct}% p.a. (≈ ${monthlyPct}%/mo)`} />
          <Row label="Monthly interest" value={<span className="text-mint-600">{inr(monthlyInt)}</span>} />
          <Row label="Tenure" value={`${i.tenure_months} months${i.tenure_days ? ` ${i.tenure_days} days` : ''}`} />
          <Row label="Started" value={fmtDate(i.start_date)} />
          <Row label="Goal" value={i.goal_name ? <Link href="/goals" className="text-sky-600">{i.goal_name} →</Link> : '—'} />
          <Row label="Nominee" value={i.nominee} />
          <Row label="Auto-renew" value={i.auto_renew ? <span className="text-mint-600">on · reminder 30d before</span> : 'off'} />
        </div>

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
