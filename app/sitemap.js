export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://investmenttracker.app';
  const lastModified = new Date();

  return [
    '',
    '/login',
    '/signup',
    '/privacy',
    '/terms',
    '/about',
    '/resources',
    '/contact',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path ? 'monthly' : 'weekly',
    priority: path ? 0.7 : 1,
  }));
}
