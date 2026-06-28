export const metadata = {
  title: 'About',
  description: 'Why InvestmentTracker exists and who it is for.',
};

export default function AboutPage() {
  return (
    <main className="legal-wrap">
      <h1>About InvestmentTracker</h1>
      <p>
        InvestmentTracker is built for households that need clarity across goals, recurring commitments,
        and long-tenure instruments. We focus on practical discipline and transparent records.
      </p>

      <h2>Our product principles</h2>
      <p>1. Financial planning should feel understandable, not overwhelming.</p>
      <p>2. Privacy and trust are product features, not legal afterthoughts.</p>
      <p>3. Progress is measured by outcomes, not screen time.</p>
    </main>
  );
}
