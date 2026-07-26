import Link from 'next/link';
import '../landing.css';

export const metadata = {
  title: 'Terms — Recrewt AI',
  description: 'Recrewt AI terms of service.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="rc-landing">
      <div className="doc">
        <div className="doc-wrap">

          {/* Top rail — brand + back link */}
          <div className="doc-top">
            <Link href="/" className="doc-logo" aria-label="Recrewt AI — home">
              <img src="/assets/recrewt-logo-tight.png" alt="Recrewt AI" width="711" height="172" />
            </Link>
            <Link href="/" className="doc-back">← Back to home</Link>
          </div>

          {/* Header */}
          <span className="doc-label">Terms</span>
          <h1 className="doc-h1">Terms of Service</h1>
          <p className="doc-updated">A formal Terms of Service is being drafted.</p>

          <h2 className="doc-h2">In the meantime</h2>
          <p className="doc-p">
            Until a formal document is published, your use of Recrewt AI is
            governed by our{' '}
            <Link href="/privacy" className="doc-inline">Privacy Policy</Link>{' '}
            and the account agreement you accepted at signup.
          </p>
          <p className="doc-p">
            For questions or concerns, write to{' '}
            <a href="mailto:support@recrewtai.com" className="doc-inline">support@recrewtai.com</a>.
            We reply within one business day.
          </p>

          {/* Foot */}
          <div className="doc-foot">
            <span>© {new Date().getFullYear()} Recrewt AI</span>
            <Link href="/" className="doc-inline">Back to home</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
