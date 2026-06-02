export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <span className="text-yellow text-sm font-bold">R</span>
            </div>
            <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
          </div>
          <h1 className="font-heading font-bold text-3xl text-ink mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-mid">Effective date: 3 June 2025 &nbsp;·&nbsp; Last updated: 3 June 2025</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-soft p-8 space-y-8 text-sm text-ink leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">1. Who We Are</h2>
            <p>
              Recrewt AI is an AI-powered interview automation platform operated at{' '}
              <a href="https://recrewtai.com" className="text-violet hover:underline">recrewtai.com</a>.
              We help recruiters create interview stages, invite candidates, and evaluate responses using artificial intelligence.
            </p>
            <p className="mt-3">
              For any privacy-related questions, contact us at{' '}
              <a href="mailto:support@recrewtai.com" className="text-violet hover:underline">support@recrewtai.com</a>.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">2. Data We Collect</h2>
            <p className="mb-3">We collect the following categories of data:</p>
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="font-medium text-ink mb-1">Recruiter Data</div>
                <p className="text-gray-mid">Name, email address, company name, and account credentials when you register and use Recrewt AI.</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="font-medium text-ink mb-1">Candidate Data</div>
                <p className="text-gray-mid">Email address (collected when a recruiter sends an invite), full name (entered by the candidate), video recording of the interview, spoken responses transcribed as text, and AI-generated scores and summaries.</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="font-medium text-ink mb-1">Usage Data</div>
                <p className="text-gray-mid">Basic technical data such as page interactions and timestamps, used only to maintain and improve the platform.</p>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">3. Why We Collect It</h2>
            <p>We collect and process data solely to provide the Recrewt AI service:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-gray-mid">
              <li>To send interview invitations to candidates on behalf of recruiters</li>
              <li>To conduct and record AI-assisted video interviews</li>
              <li>To generate transcripts, speech analysis, and AI scores</li>
              <li>To allow recruiters to review and manage candidate results</li>
              <li>To authenticate users and secure account access</li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share personal data with third parties for marketing purposes.</p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">4. Who Can See Your Data</h2>
            <p>
              Candidate data (email, video, transcript, score) is only visible to the recruiter who created the role and sent the interview invite. No other recruiter or user can access another recruiter's candidate data.
            </p>
            <p className="mt-3">
              Recrewt AI staff may access data only when required to resolve a technical issue, and only with appropriate safeguards in place.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services to operate the platform. Each processes data only as necessary to provide their service:</p>
            <div className="space-y-2">
              {[
                { name: 'Supabase', use: 'Database and authentication' },
                { name: 'Anthropic', use: 'AI question generation and candidate scoring' },
                { name: 'Resend', use: 'Sending interview invitation emails' },
                { name: 'Cloudinary', use: 'Video recording storage' },
                { name: 'AssemblyAI', use: 'Speech-to-text transcription and audio analysis' },
              ].map(({ name, use }) => (
                <div key={name} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                  <span className="font-medium text-ink w-28 shrink-0">{name}</span>
                  <span className="text-gray-mid">{use}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">6. Data Retention</h2>
            <p>
              Recruiter account data is retained for as long as the account is active. Candidate data — including video recordings, transcripts, and scores — is retained until the recruiter deletes the role or requests deletion.
            </p>
            <p className="mt-3">
              When a role is deleted, all associated candidate data is permanently removed from our systems within 30 days.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">7. Your Rights</h2>
            <p className="mb-3">Under the Digital Personal Data Protection Act, 2023 (India), you have the right to:</p>
            <ul className="space-y-2 list-disc list-inside text-gray-mid">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete personal data</li>
              <li>Request erasure of your personal data</li>
              <li>Withdraw consent for data processing at any time</li>
              <li>Nominate a person to exercise these rights on your behalf</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:support@recrewtai.com" className="text-violet hover:underline">support@recrewtai.com</a>.
              We will respond within 72 hours.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">8. Data Security</h2>
            <p>
              We implement row-level security on all database tables, meaning each recruiter can only access their own data. Video recordings are stored in a secure cloud environment. Access to production systems is restricted to authorised personnel only.
            </p>
            <p className="mt-3">
              While we take reasonable precautions, no system is completely secure. If you become aware of a security issue, please contact us immediately at{' '}
              <a href="mailto:support@recrewtai.com" className="text-violet hover:underline">support@recrewtai.com</a>.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">9. Candidate Consent</h2>
            <p>
              Candidates receive an invitation email before any interview takes place. By clicking the interview link and entering their name, candidates acknowledge that the interview will be recorded and their responses will be reviewed by the recruiter who invited them.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of Recrewt AI after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-heading font-semibold text-base text-ink mb-3">11. Contact</h2>
            <p>
              For any questions about this Privacy Policy or how your data is handled, contact us at{' '}
              <a href="mailto:support@recrewtai.com" className="text-violet hover:underline">support@recrewtai.com</a>{' '}
              or visit{' '}
              <a href="https://recrewtai.com" className="text-violet hover:underline">recrewtai.com</a>.
            </p>
          </section>

        </div>

        <p className="text-center text-xs text-gray-mid mt-8">
          © {new Date().getFullYear()} Recrewt AI · All rights reserved
        </p>

      </div>
    </div>
  )
}