export const metadata = {
  title: 'Contact',
  description: 'Contact InvestmentTracker for support, privacy requests, and policy questions.',
};

export default function ContactPage() {
  return (
    <main className="legal-wrap">
      <h1>Contact</h1>
      <p>
        For support, privacy requests, account deletion, or policy questions, contact:
      </p>
      <p><strong>Email:</strong> support@investmenttracker.app</p>
      <p><strong>Response target:</strong> Within 3 business days</p>

      <h2>Data requests</h2>
      <p>
        Include your registered account contact and request type (access, correction, deletion, or export)
        so we can verify and process quickly.
      </p>
    </main>
  );
}
