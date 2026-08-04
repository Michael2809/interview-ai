const SITE_URL = 'https://recrewtai.com';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Only the API surface is blocked from crawling.
        // The private app routes (/dashboard, /login, ...) are deliberately
        // left crawlable so Google can actually READ the `noindex` tag in
        // their layouts — a robots.txt Disallow would hide that tag and the
        // pages could linger in the index indefinitely.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
