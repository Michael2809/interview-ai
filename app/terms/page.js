import Link from "next/link";

export const metadata = {
  title: "Terms — Recrewt AI",
  description: "Recrewt AI terms of service.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <span className="text-yellow text-sm font-bold">R</span>
            </div>
            <span className="font-heading font-bold text-lg text-ink">
              Recrewt AI
            </span>
          </div>
          <h1 className="font-heading font-bold text-3xl text-ink mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-mid">
            Effective date: — · Last updated: —
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-soft p-8 space-y-6 text-sm text-ink leading-relaxed">
          <p>
            A formal Terms of Service is being drafted. Until it is published,
            your use of Recrewt AI is governed by our{" "}
            <Link href="/privacy" className="text-violet hover:underline">
              Privacy Policy
            </Link>{" "}
            and the account agreement you accepted at signup.
          </p>
          <p>
            For questions in the meantime, write to{" "}
            <a
              href="mailto:support@recrewtai.com"
              className="text-violet hover:underline"
            >
              support@recrewtai.com
            </a>
            .
          </p>
        </div>

        <p className="text-center text-xs text-gray-mid mt-8">
          © {new Date().getFullYear()} Recrewt AI · All rights reserved
        </p>
      </div>
    </div>
  );
}
