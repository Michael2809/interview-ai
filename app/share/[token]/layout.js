/**
 * Share links must never be indexed.
 *
 * The token is the only thing protecting the page, so a crawler that
 * finds one in a forwarded email footer and files it in a search index
 * has effectively published a candidate's interview. noindex/nofollow
 * plus noarchive is the cheapest correct answer.
 */
export const metadata = {
  title: 'Interview result — Recrewt AI',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noarchive: true, nosnippet: true },
  },
}

export default function ShareLayout({ children }) {
  return children
}
