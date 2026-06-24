'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, inrShort, fmtDate, TYPE_META, toneFor, labelFor } from '@/lib/format';
import { effectiveCurrentValue, effectiveInvestedSoFar, isMarketInvestment } from '@/lib/investments';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

export default function HomeClient({ user }) {
  const [goals, setGoals] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const totalValue = investments.reduce((sum, investment) => sum + effectiveCurrentValue(investment), 0);
  const totalInvested = investments.reduce((sum, investment) => sum + effectiveInvestedSoFar(investment), 0);
  const totalReturns = totalValue - totalInvested;
  const returnPct = totalInvested ? ((totalReturns / totalInvested) * 100).toFixed(1) : '0.0';

  const maturingSoon = investments.filter((investment) => {
    if (isMarketInvestment(investment.type_code) || !investment.maturity_date) return false;
    const days = (new Date(investment.maturity_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  }).length;

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
        <div className="px-4 md:px-8 py-5 md:py-6 max-w-5xl mx-auto w-full">
          <div className="md:flex md:items-end md:justify-between mb-5">
            <div>
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Portfolio value</p>
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-1">{inr(totalValue)}</h1>
              <p className={`text-sm mt-1.5 ${totalReturns >= 0 ? 'text-mint-600' : 'text-danger'}`}>{totalReturns >= 0 ? '+' : ''}{inr(totalReturns)} ({returnPct}%)</p>
            </div>
            <Link href="/investments/new" className="hidden md:inline-flex items-center gap-1.5 btn-primary py-2 px-4 rounded-full text-sm font-medium">+ Add investment</Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition"><p className="text-[11px] text-ink-mute">Active plans</p><p className="text-lg font-medium mt-1">{investments.length} <span className="text-ink-mute text-sm">→</span></p></Link>
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition"><p className="text-[11px] text-ink-mute">Maturing in 30 days</p><p className="text-lg font-medium mt-1 text-honey-600">{maturingSoon} <span className="text-ink-mute text-sm">→</span></p></Link>
            <Link href="/goals" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition"><p className="text-[11px] text-ink-mute">Goals</p><p className="text-lg font-medium mt-1">{goals.length} <span className="text-ink-mute text-sm">→</span></p></Link>
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition"><p className="text-[11px] text-ink-mute">Total invested</p><p className="text-lg font-medium mt-1">{inrShort(totalInvested)}</p></Link>
          </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
              <div className="flex justify-between items-baseline mb-3"><h2 className="text-sm font-medium">Goals</h2><Link href="/goals" className="text-xs text-sky-600">see all</Link></div>
              {goals.length === 0 ? (
                <Link href="/goals/new" className="block text-center py-6 text-sm text-ink-mute border border-dashed border-edge rounded-xl hover:bg-paper-tint">+ Add your first goal</Link>
              ) : goals.slice(0, 3).map((g) => {
                const cur = Number(g.current_amount || 0);
                const tgt = Number(g.target_amount || 1);
                const pct = Math.min(100, Math.round((cur / tgt) * 100));
                return (
                  <Link key={g.id} href="/goals" className="block bg-paper-tint rounded-xl p-3 mb-2 hover:bg-paper-card hover:border hover:border-edge transition">
                    <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">{g.name}</span><span className="text-xs text-ink-soft">{pct}%</span></div>
                    <div className="h-1.5 bg-paper-card rounded-full overflow-hidden"><div className="fill-bar h-full bg-mint-600 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </Link>
                );
              })}
            </section>

            <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
              <div className="flex justify-between items-baseline mb-3"><h2 className="text-sm font-medium">Recent investments</h2><Link href="/investments" className="text-xs text-sky-600">view all</Link></div>
              {investments.slice(0, 4).map((investment) => {
                const tone = toneFor(investment.type_code);
                const marketType = isMarketInvestment(investment.type_code);
                return (
                  <Link key={investment.id} href={`/investments/${investment.id}`} className="flex items-center justify-between py-2.5 border-b border-edge last:border-b-0 hover:bg-paper-tint/50 -mx-2 px-2 rounded transition">
                    <div className="flex gap-2.5 items-center min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${TONE_BG[tone]}`}>{TYPE_META[investment.type_code]?.short || 'OT'}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{investment.bank} · {investment.plan_name}</p>
                        <p className="text-[11px] text-ink-mute mt-0.5">{labelFor(investment)} · {marketType ? `${formatUnits(investment.total_units)} units held` : `matures ${fmtDate(investment.maturity_date)}`}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-xs font-medium">{inrShort(marketType ? investment.remaining_cost_basis : investment.amount)}</p>
                      <p className={`text-[10px] mt-0.5 ${marketType ? 'text-sky-600' : 'text-mint-600'}`}>{marketType ? `${inrShort(investment.invested_amount)} invested` : `${investment.rate_pct}% p.a.`}</p>
                    </div>
                  </Link>
                );
              })}
            </section>
          </div>
        </div>
      )}
    </Shell>
  );
}
