import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://investmenttracker.app'),
  title: {
    default: 'InvestmentTracker | Plan long-term goals with confidence',
    template: '%s | InvestmentTracker',
  },
  description: 'A privacy-first investment tracker for families. Plan goals, track installments, and stay in control.',
  applicationName: 'InvestmentTracker',
  keywords: ['investment tracker', 'goal planning', 'personal finance app', 'portfolio tracking'],
  openGraph: {
    title: 'InvestmentTracker',
    description: 'Track investments and long-term goals in one secure dashboard.',
    type: 'website',
    siteName: 'InvestmentTracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InvestmentTracker',
    description: 'Track investments and long-term goals in one secure dashboard.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F6E56',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
