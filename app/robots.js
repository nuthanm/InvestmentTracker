export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://investmenttracker.app';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms', '/about', '/resources', '/contact', '/login', '/signup'],
      disallow: ['/home', '/goals', '/investments', '/notifications', '/account', '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
