'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { inr, inrShort, fmtDate, TYPE_META, toneFor, labelFor } from '@/lib/format';
import { effectiveCurrentValue, effectiveInvestedSoFar, isMarketInvestment } from '@/lib/investments';
import PortfolioChart from './PortfolioChart';

const TONE_BG = { mint:'bg-mint-50 text-mint-700', sky:'bg-sky-50 text-sky-600', ember:'bg-ember-50 text-ember-600', honey:'bg-honey-50 text-honey-600', plum:'bg-plum-50 text-plum-600', rose:'bg-rose-50 text-rose-600' };

function formatUnits(value) {
  const n = Number(value || 0);
  return n.toFixed(n % 1 === 0 ? 0 : 3);
}

function buildUpcomingOptions({ investments, goals, maturingSoon }) {
  const byType = investments.reduce((acc, inv) => {
    const code = inv.type_code || 'OT';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});

  const monthlyPlans = investments.filter((inv) => inv.payment_frequency === 'monthly').length;
  const yearlyPlans = investments.filter((inv) => inv.payment_frequency === 'yearly').length;

  const options = [];

  if (maturingSoon > 0) {
    options.push({
      key: 'rollover',
      title: 'Maturity rollover window',
      why: `${maturingSoon} plan${maturingSoon > 1 ? 's are' : ' is'} maturing soon. Keep returns working by planning reinvestment early.`,
      tag: 'Time sensitive',
      href: '/investments',
      cta: 'Review maturing plans',
    });
  }

  if (!byType.MF && !byType.ETF && !byType.ST) {
    options.push({
      key: 'growth',
      title: 'Growth allocation option',
      why: 'Your portfolio is mostly fixed-income right now. You can explore adding a growth bucket for long-term goals.',
      tag: 'Balance mix',
      href: '/investments/new',
      cta: 'Add growth investment',
    });
  }

  if (!byType.PPF) {
    options.push({
      key: 'ppf',
      title: 'Long-horizon safety option',
      why: 'No PPF plan found yet. Consider adding a long-term, disciplined account for family corpus building.',
      tag: 'Long term',
      href: '/investments/new',
      cta: 'Add long-term plan',
    });
  }

  if (monthlyPlans < 2) {
    options.push({
      key: 'monthly',
      title: 'Monthly contribution option',
      why: 'Monthly plans improve consistency. Add at least one recurring plan to reduce timing gaps.',
      tag: 'Consistency',
      href: '/investments/new',
      cta: 'Create monthly plan',
    });
  }

  if (goals.length > 0 && yearlyPlans === 0) {
    options.push({
      key: 'goal-yearly',
      title: 'Yearly top-up option',
      why: 'You have goals but no yearly contribution plans. A yearly top-up can boost goal pace.',
      tag: 'Goal pace',
      href: '/goals',
      cta: 'Check goal gaps',
    });
  }

  if (options.length === 0) {
    options.push({
      key: 'review',
      title: 'Portfolio review opportunity',
      why: 'Your mix looks healthy. Review rates, maturities, and account holders to optimize the next cycle.',
      tag: 'Review',
      href: '/investments',
      cta: 'Open investments',
    });
  }

  return options.slice(0, 3);
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

/** Overall Wealth Goal card – shows current progress and lets user set/edit goal. */
function WealthGoalCard({ currentValue, investedValue, onGoalChange }) {
  const [goal, setGoal] = useState(null);   // { amount, date } | null
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ amount: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/portfolio-goal').then((r) => r.json()).then((d) => {
      setGoal(d.goal);
      setLoaded(true);
      if (d.goal) onGoalChange(d.goal);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = () => {
    setForm({ amount: goal?.amount ? String(goal.amount) : '', date: goal?.date ? String(goal.date).slice(0, 10) : '' });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid goal amount.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/portfolio-goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(form.amount), date: form.date || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      const newGoal = { amount: Number(form.amount), date: form.date || null };
      setGoal(newGoal);
      onGoalChange(newGoal);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeGoal = async () => {
    await fetch('/api/portfolio-goal', { method: 'DELETE' });
    setGoal(null);
    onGoalChange(null);
    setEditing(false);
  };

  if (!loaded) return null;

  if (editing) {
    return (
      <div className="bg-paper-card border border-mint-600 rounded-2xl p-4 md:p-5 mb-5">
        <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-3">Set Overall Wealth Goal</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-ink-soft mb-1">Target amount (₹)<span className="text-danger ml-0.5">*</span></label>
            <input type="number" inputMode="numeric" autoFocus value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 5000000" className="field-input" />
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">Target date <span className="text-[10px] text-ink-mute">optional</span></label>
            <input type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="field-input" />
          </div>
        </div>
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost py-1.5 px-4 rounded-lg text-xs">Cancel</button>
          {goal && <button type="button" onClick={removeGoal} className="btn-ghost py-1.5 px-4 rounded-lg text-xs text-danger hover:border-danger">Remove</button>}
          <button type="button" disabled={saving} onClick={save} className="btn-primary flex-1 py-1.5 rounded-lg text-xs font-medium">
            {saving ? 'Saving…' : 'Save goal'}
          </button>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="border border-dashed border-edge rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Set an overall wealth goal</p>
          <p className="text-[11px] text-ink-mute mt-0.5">Track how your portfolio is progressing towards your target</p>
        </div>
        <button onClick={openEdit} className="btn-primary py-1.5 px-4 rounded-full text-xs font-medium flex-shrink-0 ml-3">+ Set goal</button>
      </div>
    );
  }

  const pct = Math.min(100, goal.amount > 0 ? Math.round((investedValue / goal.amount) * 100) : 0);
  const remaining = Math.max(0, goal.amount - investedValue);

  return (
    <div className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5 mb-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[11px] text-ink-mute uppercase tracking-wider">Overall Wealth Goal</p>
          <p className="text-xl font-medium mt-0.5">{inrShort(goal.amount)}</p>
          {goal.date && <p className="text-[11px] text-ink-mute mt-0.5">Target: {fmtDate(goal.date)}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium text-mint-600">{pct}%</p>
          <p className="text-[11px] text-ink-mute">{inrShort(remaining)} to go</p>
        </div>
      </div>
      <div className="h-2.5 bg-paper-tint rounded-full overflow-hidden mb-3">
        <div className="fill-bar h-full bg-mint-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center text-[11px] text-ink-mute">
        <span>
          <span>{inrShort(currentValue)} projected value</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span>{inrShort(investedValue)} invested so far</span>
        </span>
        <button onClick={openEdit} className="text-sky-600 hover:underline">edit goal</button>
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

  // totalValue = sum of maturity values (future projected value)
  const totalValue = investments.reduce((sum, inv) => sum + effectiveCurrentValue(inv), 0);
  const totalCurrentPortfolioValue = investments.reduce(
    (sum, inv) => sum + (isMarketInvestment(inv.type_code) ? effectiveCurrentValue(inv) : effectiveInvestedSoFar(inv)),
    0
  );
  // totalInvested = amount invested so far (respects start_date for periodic investments)
  const totalInvested = investments.reduce((sum, inv) => sum + effectiveInvestedSoFar(inv), 0);

  const maturingSoon = investments.filter((inv) => {
    if (isMarketInvestment(inv.type_code) || !inv.maturity_date) return false;
    const days = (new Date(inv.maturity_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  }).length;

  const upcomingOptions = buildUpcomingOptions({ investments, goals, maturingSoon });

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
          {/* ── Header ── */}
          <div className="md:flex md:items-end md:justify-between mb-5">
            <div>
              <p className="text-[11px] tracking-wider text-ink-mute uppercase">Current Portfolio Value</p>
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-1">{inr(totalCurrentPortfolioValue)}</h1>
              <p className="text-sm text-ink-soft mt-1.5">Projected maturity value: {inr(totalValue)}</p>
            </div>
            <Link href="/investments/new" className="hidden md:inline-flex items-center gap-1.5 btn-primary py-2 px-4 rounded-full text-sm font-medium">+ Add investment</Link>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition">
              <p className="text-[11px] text-ink-mute">Active plans</p>
              <p className="text-lg font-medium mt-1">{investments.length} <span className="text-ink-mute text-sm">→</span></p>
            </Link>
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition">
              <p className="text-[11px] text-ink-mute">Maturing in 30 days</p>
              <p className="text-lg font-medium mt-1 text-honey-600">{maturingSoon} <span className="text-ink-mute text-sm">→</span></p>
            </Link>
            <Link href="/goals" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition">
              <p className="text-[11px] text-ink-mute">Goals</p>
              <p className="text-lg font-medium mt-1">{goals.length} <span className="text-ink-mute text-sm">→</span></p>
            </Link>
            <Link href="/investments" className="bg-paper-card border border-edge rounded-xl p-3.5 hover:border-mint-600 transition">
              <p className="text-[11px] text-ink-mute">
                Maturity value
                <InfoTip text="The total amount you will receive when all your investments mature at their respective rates. This is a future projected value, not what you'd get if you withdrew today." />
              </p>
              <p className="text-lg font-medium mt-1 text-mint-600">{inrShort(totalValue)}</p>
            </Link>
          </div>

          {/* ── Overall Wealth Goal ── */}
          <WealthGoalCard currentValue={totalValue} investedValue={totalInvested} onGoalChange={setPortfolioGoal} />

          {/* ── Upcoming investment options ── */}
          <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5 mb-5">
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="text-sm font-medium">Upcoming investment options</h2>
              <Link href="/investments/new" className="text-xs text-sky-600">add new</Link>
            </div>
            <p className="text-[11px] text-ink-mute mb-3">Suggestions are based on your current plan mix and timelines. This is a planning aid, not investment advice.</p>
            <div className="grid md:grid-cols-3 gap-2.5">
              {upcomingOptions.map((option) => (
                <article key={option.key} className="border border-edge rounded-xl p-3 bg-paper-tint/60">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-medium leading-5">{option.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 border border-mint-100 whitespace-nowrap">{option.tag}</span>
                  </div>
                  <p className="text-[11px] text-ink-mute leading-5 min-h-[52px]">{option.why}</p>
                  <Link href={option.href} className="inline-flex mt-2 text-[11px] font-medium text-sky-600 hover:underline">{option.cta} →</Link>
                </article>
              ))}
            </div>
          </section>

          {/* ── Portfolio projection chart ── */}
          <div className="mb-5">
            <PortfolioChart
              investments={investments}
              goalAmount={portfolioGoal?.amount ?? null}
              goalDate={portfolioGoal?.date ?? null}
            />
          </div>

          {/* ── Goals + Recent investments ── */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
              <div className="flex justify-between items-baseline mb-3">
                <h2 className="text-sm font-medium">Goals</h2>
                <Link href="/goals" className="text-xs text-sky-600">see all</Link>
              </div>
              {goals.length === 0 ? (
                <Link href="/goals/new" className="block text-center py-6 text-sm text-ink-mute border border-dashed border-edge rounded-xl hover:bg-paper-tint">+ Add your first goal</Link>
              ) : goals.slice(0, 3).map((g) => {
                const cur = Number(g.current_amount || 0);
                const tgt = Number(g.target_amount || 1);
                const pct = Math.min(100, Math.round((cur / tgt) * 100));
                return (
                  <Link key={g.id} href="/goals" className="block bg-paper-tint rounded-xl p-3 mb-2 hover:bg-paper-card hover:border hover:border-edge transition">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{g.name}</span>
                      <span className="text-xs text-ink-soft">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-paper-card rounded-full overflow-hidden">
                      <div className="fill-bar h-full bg-mint-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </section>

            <section className="bg-paper-card border border-edge rounded-2xl p-4 md:p-5">
              <div className="flex justify-between items-baseline mb-3">
                <h2 className="text-sm font-medium">Recent investments</h2>
                <Link href="/investments" className="text-xs text-sky-600">view all</Link>
              </div>
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
