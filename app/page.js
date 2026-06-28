import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export const metadata = {
  title: 'Investment Tracker for Everyday Families',
  description: 'Track investments, goals, and payment schedules with one simple system.',
};

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
      priceCurrency: 'USD',
    },
  };

  return (
    <main className="landing-wrap">
      <header className="landing-top">
        <Link href="/" className="landing-brand">InvestmentTracker</Link>
        <nav className="landing-top-nav">
          <Link href="/resources">Guides</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login" className="landing-signin">Sign in</Link>
        </nav>
      </header>

      <section className="hero-grid">
        <div>
          <p className="hero-kicker">Calm Money OS for modern families</p>
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
            <div><strong>0</strong><span>Ad cost in private workspace</span></div>
            <div><strong>100%</strong><span>User-owned data export</span></div>
            <div><strong>24x7</strong><span>Access to your plan</span></div>
          </div>
        </div>

        <aside className="hero-card">
          <h2>What happens after sign up</h2>
          <ul>
            <li>Build a goal map: education, home, emergency, travel.</li>
            <li>Add investment instruments with exact due cadence.</li>
            <li>Enable MFA and recovery key in under 2 minutes.</li>
            <li>Download your full data snapshot anytime.</li>
          </ul>
          <div className="hero-card-badge">No broker lock-in. No forced subscriptions.</div>
        </aside>
      </section>

      <section className="feature-band">
        <article>
          <h3>Goal Lens</h3>
          <p>Every amount is tied to a life objective so the portfolio tells a story, not just numbers.</p>
        </article>
        <article>
          <h3>Discipline Rail</h3>
          <p>Installment timelines make misses obvious early, so recurring investment plans stay controlled.</p>
        </article>
        <article>
          <h3>Family Ledger</h3>
          <p>Separate account holders while keeping one dependable household picture.</p>
        </article>
      </section>

      <section className="product-peek">
        <div className="product-peek-copy">
          <p className="peek-kicker">See the product before signup</p>
          <h2>This preview maps directly to the real home dashboard</h2>
          <p>
            Card titles and section flow below are aligned with the implemented app,
            including portfolio summary, wealth goal progress, upcoming options, and recent investments.
          </p>
        </div>

        <div className="product-mock-grid">
          <article className="mock-desktop mock-home-main">
            <div className="mock-app-head">
              <span className="mock-app-pill on">Home</span>
              <span className="mock-app-pill">Goals</span>
              <span className="mock-app-pill">List</span>
              <span className="mock-app-pill">Account</span>
            </div>
            <div className="mock-topline">
              <span>Current Portfolio Value</span>
              <strong>Rs 18,74,500</strong>
            </div>
            <p className="mock-subline">Projected maturity value: Rs 22,18,000</p>
            <div className="mock-stats">
              <div><label>Active plans</label><b>12</b></div>
              <div><label>Maturing in 30 days</label><b>3</b></div>
              <div><label>Goals</label><b>4</b></div>
              <div><label>Maturity value</label><b>Rs 22.18L</b></div>
            </div>

            <div className="mock-section-title">Overall Wealth Goal</div>
            <div className="mock-goal-row">
              <span>Target: Child Education + Retirement</span>
              <span>Rs 34L / Rs 50L</span>
            </div>
            <div className="mock-progress"><i style={{ width: '68%' }} /></div>

            <div className="mock-section-title">Upcoming investment options</div>
            <div className="mock-option-grid main-options">
              <div className="mock-option-card">
                <strong>Maturity rollover window</strong>
                <small>3 plans are maturing soon</small>
                <span className="mock-option-tag">Time sensitive</span>
              </div>
              <div className="mock-option-card">
                <strong>Monthly contribution option</strong>
                <small>Add one more recurring plan</small>
                <span className="mock-option-tag">Consistency</span>
              </div>
              <div className="mock-option-card">
                <strong>Long-horizon safety option</strong>
                <small>Add a long-term account for family corpus</small>
                <span className="mock-option-tag">Long term</span>
              </div>
            </div>

            <div className="mock-section-title">Portfolio projection</div>
            <div className="mock-chart-card">
              <div className="mock-chart-line" />
              <div className="mock-chart-dots">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="mock-section-title">Recent investments</div>
            <ul className="mock-list">
              <li><span>HDFC Growth Fund</span><em className="ok">Next SIP: 05 Jul</em></li>
              <li><span>SBI Long Term FD</span><em className="warn">Matures: 18 Jul</em></li>
              <li><span>PPF Primary Account</span><em className="warn">Deposit due: 10 Jul</em></li>
            </ul>
          </article>

          <article className="mock-mobile mock-home-side">
            <header>Goals</header>
            <div className="mock-goals-list">
              <div className="mock-goal-item">
                <div className="mock-goal-item-head"><span>Child Education</span><em>68%</em></div>
                <div className="mock-progress thin"><i style={{ width: '68%' }} /></div>
              </div>
              <div className="mock-goal-item">
                <div className="mock-goal-item-head"><span>Home Upgrade</span><em>41%</em></div>
                <div className="mock-progress thin"><i style={{ width: '41%' }} /></div>
              </div>
            </div>

            <header className="side-subtitle">Recent investments</header>
            <ul className="mock-side-list">
              <li><span>Reliance Large Cap</span><em className="ok">SIP on 05 Jul</em></li>
              <li><span>Gold ETF</span><em className="warn">Top-up this week</em></li>
            </ul>
          </article>
        </div>
      </section>

      <section className="story-band">
        <article>
          <h2>Designed for trust, not virality.</h2>
          <p>
            Security controls, MFA, recovery key, and audit events are built into the product journey.
            This is intentional software for long-term planning, not attention-hacking finance media.
          </p>
        </article>
        <article>
          <h2>Free core forever.</h2>
          <p>
            No paid integrations are required for account access and recovery. You only pay for your own
            hosting choices like domain or storage upgrades.
          </p>
        </article>
      </section>

      <section className="trust-strip">
        <p>
          Privacy-first architecture. No ads inside authenticated workspace. This app is a tracking tool
          and does not provide investment advice.
        </p>
      </section>

      <footer className="landing-footer">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/about">About</Link>
        <Link href="/resources">Resources</Link>
        <Link href="/contact">Contact</Link>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
