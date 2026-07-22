import Link from 'next/link';
import { ScanFace } from 'lucide-react';

/**
 * The brand block (icon + wordmark). Used at the top of the sidebar
 * and the mobile top-bar. Clicking it takes the user to /dashboard.
 *
 * Visual language matches the landing page top-of-page wordmark:
 * ink chip with a yellow monogram icon, Archivo editorial wordmark,
 * restrained sizing.
 */
export default function Brand({ onClick }) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      aria-label="Recrewt AI - Dashboard"
      className="inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 rounded"
    >
      <span
        aria-hidden="true"
        className="shrink-0 h-7 w-7 rounded-[8px] bg-[color:var(--color-rc-ink)] grid place-items-center"
      >
        <ScanFace className="text-[color:var(--color-rc-yellow)]" size={15} strokeWidth={2} />
      </span>
      <span
        className="text-[15.5px] leading-none font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        Recrewt AI
      </span>
    </Link>
  );
}
