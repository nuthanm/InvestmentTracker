import Link from 'next/link';
import BrandMark from './BrandMark';

const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms' },
  { href: '/about', label: 'About' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },
];

/** Shared header and footer for the landing page and the public information pages. */
export function PublicHeader() {
  return (
    <header className="landing-top">
      <Link href="/" className="landing-brand"><BrandMark size="sm" />InvestmentTracker</Link>
      <nav className="landing-top-nav" aria-label="Site">
        <Link href="/resources">Guides</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/login" className="hero-primary">Sign in</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="landing-footer">
      {FOOTER_LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      <span className="landing-footer-note">© {new Date().getFullYear()} InvestmentTracker · a tracking tool, not investment advice</span>
    </footer>
  );
}

/** Wraps a public information page (About, Privacy, Terms, Resources, Contact). */
export default function PublicShell({ children }) {
  return (
    <div className="public-shell">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
