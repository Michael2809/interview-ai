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
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
