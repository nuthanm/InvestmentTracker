export const metadata = {
  title: 'About',
  description: 'Why InvestmentTracker exists, who it is for, and how the platform is built for trust.',
};

export default function AboutPage() {
  return (
    <main className="legal-wrap">
      <h1>About InvestmentTracker</h1>
      <p>
        InvestmentTracker is a practical planning workspace for families that want one clean view of goals,
        investments, recurring contributions, maturities, and upcoming action items.
      </p>

      <h2>Why we built this</h2>
      <p>
        Most households track money across notes, chats, and reminders. Important dates get missed,
        long-term plans lose momentum, and ownership across family members becomes unclear.
        InvestmentTracker brings these pieces into one dashboard so decisions become calmer and more consistent.
      </p>

      <h2>Who it is for</h2>
      <p>
        This product is designed for everyday investors, families, and goal-focused planners who want
        discipline without complexity. It works especially well for users managing a mix of fixed-income,
        market-linked, and recurring instruments.
      </p>

      <h2>What you can do in the app</h2>
      <p>1. Define goals and map investments to each goal.</p>
      <p>2. Track monthly or yearly contribution plans and payment records.</p>
      <p>3. Monitor maturities, due items, and portfolio progress in one board.</p>
      <p>4. Use account-level security features such as MFA, recovery key, and security activity logs.</p>
      <p>5. Export your own data whenever needed.</p>

      <h2>Trust and privacy approach</h2>
      <p>
        We treat privacy and security as core product behavior, not optional features. The product includes
        authentication controls, security event tracking, and transparent legal pages so users know how data is handled.
      </p>

      <h2>Important scope note</h2>
      <p>
        InvestmentTracker is a tracking and planning tool. It does not provide investment advice,
        brokerage, custody, or guaranteed return recommendations.
      </p>
    </main>
  );
}
