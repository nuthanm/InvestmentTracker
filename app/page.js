import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import Icon from '@/components/Icon';
import BrandMark from '@/components/BrandMark';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { GoalWaterFill, TypeThumbnail, WaterTank } from '@/components/GrowthVisual';

export const metadata = {
  title: 'InvestmentTracker | Investments and goals for everyday families',
  description: 'Track investments, goals, and payment schedules with one simple system.',
};

const AFTER_SIGNUP = [
  { icon: 'target', text: 'Build a goal map: education, home, emergency, travel.' },
  { icon: 'calendar', text: 'Add investment instruments with their exact due dates.' },
  { icon: 'shield', text: 'Turn on MFA and save backup codes in under 2 minutes.' },
  { icon: 'archive', text: 'Download your full data any time.' },
];

const FACTS = [
  { icon: 'layers', title: '11 plan types', note: 'FD, RD, PPF, chit, gold, silver, MF, stocks and more' },
  { icon: 'shield', title: 'MFA built in', note: 'Authenticator app plus backup codes' },
  { icon: 'archive', title: 'Your data', note: 'Export everything, any time' },
];

const PREVIEW_ALLOCATION = [
  { label: 'Debt', tone: 'mint', pct: 54 },
  { label: 'Equity', tone: 'sky', pct: 24 },
  { label: 'Metals', tone: 'honey', pct: 15 },
  { label: 'Cash', tone: 'plum', pct: 7 },
];

const PREVIEW_ROWS = [
  { type: 'FD', title: 'SBI · Long Term FD', meta: '7.10% p.a. · matures 18 Jul 2027', amount: '₹3,00,000', note: 'invested' },
  { type: 'MF', title: 'HDFC · Flexi Cap Fund', meta: 'SIP ₹5,000/mo · next on 05 Dec', amount: '₹1,42,300', note: 'cost basis' },
  { type: 'GOLD', title: 'GRT · 22K chain', meta: '12.400 g accumulated', amount: '12.400 g', note: '₹82.4K cost' },
  { type: 'RD', title: 'Post Office · RD', meta: '₹2,000/mo · 14 of 60 paid', amount: '₹28,000', note: 'invested so far', ratio: 0.23 },
];

const PREVIEW_GOALS = [
  { name: 'Child education', pct: 68 },
  { name: 'Emergency fund', pct: 41 },
];

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect('/home');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'InvestmentTracker',
    applicationCategory: 'FinanceApplication',
    description: 'Track goals and recurring investment payments in one place.',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
  };

  return (
    <main className="landing-wrap">
      <PublicHeader />

      <section className="hero-grid">
        <div>
          <p className="hero-kicker">Simple money planner for families</p>
          <h1 className="hero-title">One living board for investments and every future bill.</h1>
          <p className="hero-sub">
            Instead of juggling notes and reminders, create a single source of truth where each goal,
            installment, and maturity date is visible before it becomes a problem.
          </p>
          <div className="hero-cta-row">
            <Link href="/signup" className="hero-primary">Start free forever</Link>
            <Link href="/login" className="hero-secondary">I already have an account</Link>
          </div>
          <div className="hero-metrics">
            {FACTS.map((fact) => (
              <div key={fact.title}>
                <span className="hero-metric-icon"><Icon name={fact.icon} size={16} /></span>
                <strong>{fact.title}</strong>
                <span>{fact.note}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="hero-card">
          <h2>What happens after sign up</h2>
          <ul className="icon-list">
            {AFTER_SIGNUP.map((item) => (
              <li key={item.text}><span className="icon-list-icon"><Icon name={item.icon} size={16} /></span>{item.text}</li>
            ))}
          </ul>
          <div className="hero-card-badge">No broker lock-in. No forced subscriptions.</div>
        </aside>
      </section>

      <section className="feature-band">
        <article>
          <div className="feature-glyph goal-water-card" aria-hidden="true"><GoalWaterFill pct={62} /></div>
          <h3>Goal Lens</h3>
          <p>Every amount is tied to a life objective, so the portfolio tells a story, not just numbers.</p>
        </article>
        <article>
          <div className="feature-glyph" aria-hidden="true"><TypeThumbnail typeCode="RD" ratio={0.7} /></div>
          <h3>Discipline Rail</h3>
          <p>Installment timelines make misses obvious early, so recurring investment plans stay on track.</p>
        </article>
        <article>
          <div className="feature-glyph" aria-hidden="true"><TypeThumbnail typeCode="FD" /></div>
          <h3>Family Ledger</h3>
          <p>Separate account holders while keeping one dependable household picture.</p>
        </article>
      </section>

      <section className="product-peek">
        <div className="product-peek-copy">
          <p className="peek-kicker">See the product before signup</p>
          <h2>This preview uses the same parts as the real home screen</h2>
          <p>Portfolio value, allocation, plan counts, recent investments, goals and upcoming dates, with sample figures.</p>
        </div>

        <div className="peek-app" aria-label="Sample home screen">
          <div className="peek-rail" aria-hidden="true">
            <BrandMark size="sm" />
            <span className="peek-rail-item is-active"><Icon name="home" /></span>
            <span className="peek-rail-item"><Icon name="wallet" /></span>
            <span className="peek-rail-item"><Icon name="target" /></span>
            <span className="peek-rail-item"><Icon name="calendar" /></span>
          </div>

          <div className="peek-main">
            <div className="home-hero">
              <div className="min-w-0">
                <p className="home-hero-label">Portfolio value</p>
                <p className="portfolio-hero-value text-3xl leading-tight tracking-tight mt-1 mb-3 tabular-nums">₹18,74,500</p>
                <div className="flex flex-wrap gap-2">
                  <span className="delta-pill is-up"><Icon name="arrowUp" size={14} strokeWidth={2.4} />+₹3.44L · 18.4%<small>by maturity</small></span>
                  <span className="home-chip">Avg rate <b>7.35% p.a.</b></span>
                </div>
              </div>
              <div className="water-tanks">
                {PREVIEW_ALLOCATION.map((slice) => <WaterTank key={slice.label} pct={slice.pct} tone={slice.tone} label={slice.label} />)}
              </div>
            </div>

            <div className="kpi-grid peek-kpis">
              <div className="kpi-tile"><span className="kpi-icon kpi-tone-mint"><Icon name="layers" /></span><span className="kpi-label">Active plans</span><span className="kpi-value">12</span><span className="kpi-note">of 14 plans</span></div>
              <div className="kpi-tile is-alert"><span className="kpi-icon kpi-tone-honey"><Icon name="clock" /></span><span className="kpi-label">Due in 30 days</span><span className="kpi-value">3</span><span className="kpi-note">Contributions & maturities</span></div>
              <div className="kpi-tile"><span className="kpi-icon kpi-tone-plum"><Icon name="target" /></span><span className="kpi-label">Goals progress</span><span className="kpi-value">55%</span><span className="kpi-note">avg across 4 goals</span></div>
            </div>

            <div className="peek-cols">
              <div className="peek-card">
                <h3 className="section-title"><Icon name="wallet" />Recent investments</h3>
                <ul className="peek-rows">
                  {PREVIEW_ROWS.map((row) => (
                    <li key={row.title}>
                      <span className="peek-thumb"><TypeThumbnail typeCode={row.type} ratio={row.ratio ?? null} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="peek-row-title">{row.title}</span>
                        <span className="peek-row-meta">{row.meta}</span>
                      </span>
                      <span className="peek-row-amount">
                        <b>{row.amount}</b>
                        <small>{row.note}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="peek-card">
                <h3 className="section-title"><Icon name="target" />Goals</h3>
                <div className="flex flex-col gap-2">
                  {PREVIEW_GOALS.map((goal) => (
                    <div key={goal.name} className="goal-water-card bg-paper-tint rounded-xl p-3 overflow-hidden">
                      <GoalWaterFill pct={goal.pct} />
                      <div className="goal-on-water flex justify-between items-center text-sm">
                        <span className="font-medium">{goal.name}</span>
                        <span>{goal.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <h3 className="section-title mt-4"><Icon name="calendar" />Upcoming</h3>
                <ul className="peek-events">
                  <li><span className="peek-date"><i>Dec</i><b>05</b></span><span><b>SIP debit</b><small>HDFC Flexi Cap</small></span></li>
                  <li><span className="peek-date"><i>Jul</i><b>18</b></span><span><b>FD matures</b><small>SBI Long Term FD</small></span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="story-band">
        <article>
          <h2>Designed for trust, not virality.</h2>
          <p>
            Security controls, MFA, backup codes, and audit events are built into the product journey.
            This is intentional software for long-term planning, not attention-hacking finance media.
          </p>
        </article>
      </section>

      <section className="trust-strip">
        <p>
          Privacy-first architecture. No ads inside authenticated workspace. This app is a tracking tool
          and does not provide investment advice.
        </p>
      </section>

      <PublicFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
