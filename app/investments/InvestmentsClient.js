'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, fmtDate, TYPE_META, toneFor, labelFor, frequencySuffix } from '@/lib/format';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

export default function InvestmentsClient({ user }) {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/investments').then(r => r.json()).then(d => {
      setInvestments(d.investments || []);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'ALL' ? investments : investments.filter(i => i.type_code === filter);
  // Compute total invested accurately: sum per-period × periods for recurring types
  const total = filtered.reduce((s, i) => {
    const freq = i.payment_frequency || 'lump_sum';
    const amt = Number(i.amount);
    if (freq === 'monthly') return s + amt * Number(i.tenure_months);
    if (freq === 'yearly') return s + amt * Math.floor(Number(i.tenure_months) / 12);
    return s + amt;
  }, 0);

  const types = Array.from(new Set(investments.map(i => i.type_code)));

  return (
    <Shell user={user}>
      <div className="px-4 md:px-8 py-5 md:py-6 max-w-4xl mx-auto w-full">

        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Investments</h1>
            <p className="text-sm text-ink-soft mt-1">{filtered.length} {filtered.length === 1 ? 'plan' : 'plans'} · {inr(total)} total invested</p>
          </div>
          <Link href="/investments/new" className="btn-primary py-2 px-3.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0">+ Add</Link>
        </div>

        {investments.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
            <button onClick={() => setFilter('ALL')} className={`chip whitespace-nowrap ${filter === 'ALL' ? 'on' : ''}`}>All</button>
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)} className={`chip whitespace-nowrap ${filter === t ? 'on' : ''}`}>
                {TYPE_META[t]?.label || t}
              </button>
            ))}
          </div>
        )}

        {loading && <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 bg-paper-tint rounded-xl animate-pulse" />)}</div>}

        {!loading && investments.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base font-medium mb-1">No investments yet</p>
            <p className="text-sm text-ink-soft mb-5">Add your first FD, RD, PPF, mutual fund, or other investment.</p>
            <Link href="/investments/new" className="btn-primary py-2.5 px-5 rounded-lg text-sm font-medium inline-block">Add an investment</Link>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-paper-card border border-edge rounded-2xl overflow-hidden">
            {filtered.map((i, idx) => {
              const tone = toneFor(i.type_code);
              const suffix = frequencySuffix(i.payment_frequency);
              return (
                <Link key={i.id} href={`/investments/${i.id}`}
                  className={`flex items-center gap-3 p-3.5 hover:bg-paper-tint/50 transition ${idx > 0 ? 'border-t border-edge' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 ${TONE_BG[tone]}`}>
                    {TYPE_META[i.type_code]?.short || 'OT'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.bank} · {i.plan_name}</p>
                    <p className="text-[11px] text-ink-mute mt-0.5 truncate">
                      {labelFor(i)}
                      {i.tenure_months > 0 && <> · {i.tenure_months >= 12 ? `${Math.round(i.tenure_months / 12)} yr` : `${i.tenure_months} mo`}</>}
                      {i.maturity_date && <> · matures {fmtDate(i.maturity_date)}</>}
                      {i.auto_renew && <> · auto-renew</>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[5rem]">
                    <p className="text-sm font-medium">{inr(i.amount)}{suffix && <span className="text-[11px] text-ink-soft font-normal">{suffix}</span>}</p>
                    <p className="text-[11px] text-mint-600 mt-0.5">{i.rate_pct}% p.a.</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
