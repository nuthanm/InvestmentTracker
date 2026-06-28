import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How InvestmentTracker collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="legal-wrap">
      <div className="legal-headband">
        <span>Legal</span>
        <Link href="/terms" className="legal-top-link">View Terms</Link>
      </div>
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: 2026-06-28</p>

      <h2 className="legal-section-title">1. Information we collect</h2>
      <p>
        We collect account details you provide, including your name, contact credentials, and financial tracking
        records such as goals, investments, installment history, and reminder settings.
      </p>

      <h2 className="legal-section-title">2. How we use your information</h2>
      <p>
        Your information is used to operate your account, generate portfolio and payment insights,
        maintain security, and improve core product experience.
      </p>

      <h2 className="legal-section-title">3. Data sharing</h2>
      <p>
        We do not sell your personal financial data. We only share data with infrastructure providers needed to
        run the service, under contractual confidentiality and security obligations.
      </p>

      <h2 className="legal-section-title">4. Data retention</h2>
      <p>
        We retain data while your account is active and for a limited period required for legal,
        fraud-prevention, and security purposes. You can request account deletion using the contact route below.
      </p>

      <h2 className="legal-section-title">5. Security measures</h2>
      <p>
        We apply authentication controls, hashed credentials, encrypted transport, and operational safeguards.
        No system is perfectly secure, so we continuously monitor and improve protections.
      </p>

      <h2 className="legal-section-title">6. Your choices and rights</h2>
      <p>
        Depending on your region, you may have rights to access, correct, export, or delete your personal data.
        To exercise these rights, contact us.
      </p>

      <h2 className="legal-section-title">7. Contact</h2>
      <p>
        Reach us through the contact page for privacy requests, grievance handling, or questions about this policy.
      </p>

      <p className="legal-links">
        <Link href="/terms" className="legal-cta-link">Read Terms and Conditions</Link>
      </p>
    </main>
  );
}
