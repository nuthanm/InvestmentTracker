import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export const metadata = {
  title: 'Investment and Debt Tracker for Everyday Families',
  description: 'Track investments, debt repayments, goals, and payment schedules with one simple system.',
};

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect('/home');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'InvestmentTracker',
    applicationCategory: 'FinanceApplication',
    description: 'Track goals, debts, and recurring investment payments in one place.',
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
          <h1 className="hero-title">One living board for debt, investments, and every future bill.</h1>
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
            <li>Add instruments and debts with exact due cadence.</li>
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
          <p>Installment timelines make misses obvious early, so debt and recurring plans stay controlled.</p>
        </article>
        <article>
          <h3>Family Ledger</h3>
          <p>Separate account holders while keeping one dependable household picture.</p>
        </article>
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
