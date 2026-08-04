const SITE_URL = 'https://recrewtai.com';

/**
 * Public, indexable pages only.
 * Private app routes are excluded here and carry `noindex` in their layouts.
 * When new marketing pages are added, list them here too.
 */
export default function sitemap() {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // NOTE: /terms is deliberately omitted. That page sets
    // `robots: { index: false }` because it is still a placeholder
    // ("A formal Terms of Service is being drafted"). Listing a noindex
    // page in the sitemap sends Google contradictory signals.
    // Add it back once real terms are published and the page is set to index.
  ];
}
