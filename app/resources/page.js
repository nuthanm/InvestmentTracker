import Link from 'next/link';

export const metadata = {
  title: 'Resources',
  description: 'Practical guides for goal planning, recurring investments, and portfolio discipline.',
};

const guides = [
  {
    title: 'Goal-First Planning Framework',
    summary: 'Start with target amount and deadline, then map instruments that fit risk, liquidity, and cadence.',
  },
  {
    title: 'Monthly vs Yearly Contribution Design',
    summary: 'Pick contribution frequency based on cash-flow reality instead of market headlines.',
  },
  {
    title: 'Maturity Rollover Checklist',
    summary: 'Avoid idle money after maturity using a pre-decision checklist for reinvestment windows.',
  },
  {
    title: 'Quarterly Portfolio Review Template',
    summary: 'Review consistency, goal progress, concentration risk, and due-item health every quarter.',
  },
  {
    title: 'Family Account Holder Tracking',
    summary: 'Structure investments by owner (self, spouse, parents) while keeping one household view.',
  },
  {
    title: 'Emergency and Liquidity Layering',
    summary: 'Separate near-term cash needs from long-term growth instruments to reduce forced exits.',
  },
];

export default function ResourcesPage() {
  return (
    <main className="legal-wrap">
      <h1>Resources</h1>
      <p>
        Explore practical, implementation-focused guides for long-term money management.
        These resources are designed to help you build habits, not chase noise.
      </p>

      <section className="resource-list">
        {guides.map((guide) => (
          <article key={guide.title} className="resource-card">
            <h2>{guide.title}</h2>
            <p>{guide.summary}</p>
          </article>
        ))}
      </section>

      <h2>How to use these resources with the app</h2>
      <p>1. Create goals first, then add investments aligned to each goal.</p>
      <p>2. Configure recurring plans and review upcoming options every month.</p>
      <p>3. Run a quarterly review and adjust contribution cadence where needed.</p>

      <h2>Scope reminder</h2>
      <p>
        These materials are educational and operational in nature. They are not investment advice or
        product recommendations.
      </p>

      <p className="legal-links">
        Need product details? Visit <Link href="/about">About</Link>. For policy and data handling,
        review <Link href="/privacy"> Privacy Policy</Link> and <Link href="/terms"> Terms</Link>.
      </p>
    </main>
  );
}
