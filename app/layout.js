import './globals.css';

export const metadata = {
  title: 'My Investments',
  description: 'Track every rupee in one place.',
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
