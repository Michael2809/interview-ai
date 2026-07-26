import Link from 'next/link';
import '../landing.css';

export const metadata = {
  title: 'Privacy — Recrewt AI',
  description: 'How Recrewt AI collects, uses, and protects your data.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
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
          <span className="doc-label">Privacy</span>
          <h1 className="doc-h1">Privacy Policy</h1>
          <p className="doc-updated">Effective 3 June 2025 · Last updated 3 June 2025</p>

          {/* 1 */}
          <h2 className="doc-h2">1. Who we are</h2>
          <p className="doc-p">
            Recrewt AI is an AI-powered interview automation platform operated at{' '}
            <a href="https://recrewtai.com" className="doc-inline">recrewtai.com</a>.
            We help recruiters create interview stages, invite candidates, and
            evaluate responses using artificial intelligence.
          </p>
          <p className="doc-p">
            For any privacy-related questions, contact us at{' '}
            <a href="mailto:support@recrewtai.com" className="doc-inline">support@recrewtai.com</a>.
          </p>

          {/* 2 */}
          <h2 className="doc-h2">2. Data we collect</h2>
          <p className="doc-p">
            <strong>Recruiter data.</strong> Name, email address, company name,
            and account credentials when you register and use Recrewt AI.
          </p>
          <p className="doc-p">
            <strong>Candidate data.</strong> Email address (collected when a
            recruiter sends an invite), full name (entered by the candidate),
            video recording of the interview, spoken responses transcribed as
            text, and AI-generated scores and summaries.
          </p>
          <p className="doc-p">
            <strong>Usage data.</strong> Basic technical data such as page
            interactions and timestamps, used only to maintain and improve the
            platform.
          </p>

          {/* 3 */}
          <h2 className="doc-h2">3. Why we collect it</h2>
          <p className="doc-p">We collect and process data solely to provide the Recrewt AI service: to send interview invitations to candidates on behalf of recruiters, to conduct and record AI-assisted video interviews, to generate transcripts, speech analysis, and AI scores, to allow recruiters to review and manage candidate results, and to authenticate users and secure account access.</p>
          <p className="doc-p">We do not sell, rent, or share personal data with third parties for marketing purposes.</p>

          {/* 4 */}
          <h2 className="doc-h2">4. Who can see your data</h2>
          <p className="doc-p">
            Candidate data (email, video, transcript, score) is only visible to
            the recruiter who created the role and sent the interview invite. No
            other recruiter or user can access another recruiter&rsquo;s
            candidate data.
          </p>
          <p className="doc-p">
            Recrewt AI staff may access data only when required to resolve a
            technical issue, and only with appropriate safeguards in place.
          </p>

          {/* 5 */}
          <h2 className="doc-h2">5. Third-party services</h2>
          <p className="doc-p">
            We use the following third-party services to operate the platform.
            Each processes data only as necessary to provide their service:{' '}
            <strong>Supabase</strong> for database and authentication,{' '}
            <strong>Anthropic</strong> for AI question generation and candidate
            scoring, <strong>Resend</strong> for sending interview invitation
            emails, <strong>Cloudinary</strong> for video recording storage, and{' '}
            <strong>AssemblyAI</strong> for speech-to-text transcription and
            audio analysis.
          </p>

          {/* 6 */}
          <h2 className="doc-h2">6. Data retention</h2>
          <p className="doc-p">
            Recruiter account data is retained for as long as the account is
            active. Candidate data — including video recordings, transcripts,
            and scores — is retained until the recruiter deletes the role or
            requests deletion.
          </p>
          <p className="doc-p">
            When a role is deleted, all associated candidate data is permanently
            removed from our systems within 30 days.
          </p>

          {/* 7 */}
          <h2 className="doc-h2">7. Your rights</h2>
          <p className="doc-p">
            Under the Digital Personal Data Protection Act, 2023 (India), you
            have the right to access the personal data we hold about you,
            correct inaccurate or incomplete personal data, request erasure of
            your personal data, withdraw consent for data processing at any
            time, and nominate a person to exercise these rights on your behalf.
          </p>
          <p className="doc-p">
            To exercise any of these rights, email us at{' '}
            <a href="mailto:support@recrewtai.com" className="doc-inline">support@recrewtai.com</a>.
            We will respond within 72 hours.
          </p>

          {/* 8 */}
          <h2 className="doc-h2">8. Data security</h2>
          <p className="doc-p">
            We implement row-level security on all database tables, meaning each
            recruiter can only access their own data. Video recordings are
            stored in a secure cloud environment. Access to production systems
            is restricted to authorised personnel only.
          </p>
          <p className="doc-p">
            While we take reasonable precautions, no system is completely
            secure. If you become aware of a security issue, please contact us
            immediately at{' '}
            <a href="mailto:support@recrewtai.com" className="doc-inline">support@recrewtai.com</a>.
          </p>

          {/* 9 */}
          <h2 className="doc-h2">9. Candidate consent</h2>
          <p className="doc-p">
            Candidates receive an invitation email before any interview takes
            place. By clicking the interview link and entering their name,
            candidates acknowledge that the interview will be recorded and their
            responses will be reviewed by the recruiter who invited them.
          </p>

          {/* 10 */}
          <h2 className="doc-h2">10. Changes to this policy</h2>
          <p className="doc-p">
            We may update this policy from time to time. When we do, we will
            update the &ldquo;Last updated&rdquo; date at the top of this page.
            Continued use of Recrewt AI after changes are posted constitutes
            acceptance of the updated policy.
          </p>

          {/* 11 */}
          <h2 className="doc-h2">11. Contact</h2>
          <p className="doc-p">
            For any questions about this Privacy Policy or how your data is
            handled, contact us at{' '}
            <a href="mailto:support@recrewtai.com" className="doc-inline">support@recrewtai.com</a>{' '}
            or visit{' '}
            <a href="https://recrewtai.com" className="doc-inline">recrewtai.com</a>.
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
