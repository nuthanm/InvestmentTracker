import Link from 'next/link';

export const metadata = {
  title: 'Resources',
  description: 'Practical guides for SIP consistency and goal-based money planning.',
};

const guides = [
  {
    title: 'SIP Frequency: Monthly vs Quarterly',
    summary: 'Choose a contribution rhythm that aligns with your income cycle and consistency goals.',
  },
  {
    title: 'How to Review SIP Performance Quarterly',
    summary: 'A practical checklist to separate process quality from market noise.',
  },
  {
    title: 'Building a Goal Timeline for Family Expenses',
    summary: 'Map school fees, travel, and emergency buffers into one calendar.',
  },
];

export default function ResourcesPage() {
  return (
    <main className="legal-wrap">
      <h1>Resources</h1>
      <p>Explore practical guides designed for everyday long-term money decisions.</p>

      <section className="resource-list">
        {guides.map((guide) => (
          <article key={guide.title} className="resource-card">
            <h2>{guide.title}</h2>
            <p>{guide.summary}</p>
          </article>
        ))}
      </section>

      <p className="legal-links">
        Looking for platform details? Visit <Link href="/about">About</Link>.
      </p>
    </main>
  );
}
