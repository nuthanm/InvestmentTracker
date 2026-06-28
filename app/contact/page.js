export const metadata = {
  title: 'Contact',
  description: 'Contact InvestmentTracker for support, account security, and privacy/data requests.',
};

export default function ContactPage() {
  return (
    <main className="legal-wrap">
      <h1>Contact</h1>
      <p>
        For support, privacy requests, account deletion, policy questions, or account security concerns,
        contact us through the details below.
      </p>
      <p><strong>Email:</strong> support@investmenttracker.app</p>
      <p><strong>Response target:</strong> Within 3 business days</p>

      <h2>Support request types</h2>
      <p>1. Login and account access issues</p>
      <p>2. MFA, recovery key, and security verification help</p>
      <p>3. Legacy account sync and data mapping clarifications</p>
      <p>4. Feature questions or usage guidance</p>

      <h2>Data requests</h2>
      <p>
        Include your registered account contact and request type (access, correction, deletion, or export)
        so we can verify and process quickly.
      </p>

      <h2>Information to include for faster resolution</h2>
      <p>1. Registered email address</p>
      <p>2. Issue summary and exact error message</p>
      <p>3. Approximate time the issue occurred</p>
      <p>4. Device/browser used (for web issues)</p>

      <h2>Security incident reporting</h2>
      <p>
        If you suspect unauthorized account activity, mention "Security Incident" in your email subject.
        We prioritize these reports for urgent review and guidance.
      </p>

      <h2>Policy references</h2>
      <p>
        For full details on data handling and service terms, review the Privacy Policy and Terms pages.
      </p>
    </main>
  );
}
