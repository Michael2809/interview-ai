'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ScanFace, ArrowRight, Check, Calendar, Menu, X } from 'lucide-react'

export default function HomePage() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-soft z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
                <ScanFace className="text-yellow" size={18} />
              </div>
              <span className="font-heading font-bold text-xl tracking-tight text-ink">Recrewt AI</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm text-gray-mid hover:text-ink transition-colors">How It Works</a>
              <a href="#benefits" className="text-sm text-gray-mid hover:text-ink transition-colors">Benefits</a>
              <a href="#candidate-flow" className="text-sm text-gray-mid hover:text-ink transition-colors">For Candidates</a>
              <a href="#pricing" className="text-sm text-gray-mid hover:text-ink transition-colors">Pricing</a>
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-ink hover:text-violet transition-colors">Log In</Link>
              <Link href="/login" className="bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">Start Free Trial</Link>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setNavOpen(!navOpen)} className="md:hidden text-ink">
              {navOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile menu */}
          {navOpen && (
            <div className="md:hidden pb-4 space-y-1">
              <a href="#how-it-works" onClick={() => setNavOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-gray-mid hover:bg-gray-50 hover:text-ink">How It Works</a>
              <a href="#benefits" onClick={() => setNavOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-gray-mid hover:bg-gray-50 hover:text-ink">Benefits</a>
              <a href="#candidate-flow" onClick={() => setNavOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-gray-mid hover:bg-gray-50 hover:text-ink">For Candidates</a>
              <a href="#pricing" onClick={() => setNavOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-gray-mid hover:bg-gray-50 hover:text-ink">Pricing</a>
              <div className="pt-2 flex flex-col gap-2">
                <Link href="/login" onClick={() => setNavOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-ink hover:bg-gray-50">Log In</Link>
                <Link href="/login" onClick={() => setNavOpen(false)} className="block text-center bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">Start Free Trial</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl text-ink tracking-tight leading-tight">
            Hire smarter with AI-powered interviews
          </h1>
          <p className="mt-6 text-lg text-gray-mid max-w-xl mx-auto">
            Recrewt AI generates interview questions, runs video interviews, and scores candidates automatically — so you spend time on the right people.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="inline-flex items-center gap-2 bg-violet text-white font-heading font-semibold px-6 py-3.5 rounded-lg hover:bg-violet-dark transition-colors">
              Start Free Trial
              <ArrowRight size={18} />
            </Link>
            <a href="#book-demo" className="inline-flex items-center gap-2 text-ink font-heading font-semibold px-6 py-3.5 rounded-lg border border-ink hover:bg-ink hover:text-white transition-colors">
              <Calendar size={18} />
              Book Demo
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 lg:px-8 bg-lavender">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-ink tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-gray-mid">
              From job posting to scored candidates in three steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <div className="w-12 h-12 bg-violet/10 rounded-xl flex items-center justify-center mb-6">
                <span className="font-heading font-bold text-violet text-xl">1</span>
              </div>
              <h3 className="font-heading font-semibold text-xl text-ink mb-2">Create a role</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Describe the position you're hiring for. Our AI drafts smart interview questions tailored to the role in seconds.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <div className="w-12 h-12 bg-violet/10 rounded-xl flex items-center justify-center mb-6">
                <span className="font-heading font-bold text-violet text-xl">2</span>
              </div>
              <h3 className="font-heading font-semibold text-xl text-ink mb-2">Invite candidates</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Send a single link. Candidates complete a guided video interview on their own time — no scheduling, no calls.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <div className="w-12 h-12 bg-violet/10 rounded-xl flex items-center justify-center mb-6">
                <span className="font-heading font-bold text-violet text-xl">3</span>
              </div>
              <h3 className="font-heading font-semibold text-xl text-ink mb-2">Review AI scores</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                We score clarity, pace, filler words, and sentiment. Spot top candidates fast and skip the resume guesswork.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recruiter Benefits */}
      <section id="benefits" className="py-20 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-ink tracking-tight">
              Built for recruiters
            </h2>
            <p className="mt-3 text-gray-mid">
              Spend less time screening, more time on the candidates that matter.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Cut screening time by 80%</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Stop scheduling first-round calls. Candidates self-serve their interview, and you review the highlights.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Consistent, unbiased questions</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Every candidate gets the same set of role-specific questions, so comparisons are fair and apples-to-apples.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">AI-generated scoring</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Speech clarity, pace, filler words, and sentiment analyzed automatically. See a candidate's communication snapshot at a glance.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Full transcripts & replays</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Re-watch any interview and read the full transcript. Share clips with your hiring team in one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Candidate Flow */}
      <section id="candidate-flow" className="py-20 px-6 lg:px-8 bg-yellow">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-ink tracking-tight">
              A smooth experience for candidates
            </h2>
            <p className="mt-3 text-ink/70">
              No accounts to create. No installs. Just one link and they're in.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-ink/10">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Click the invite link</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Candidates get a personalized link by email — they open it in any browser, on any device.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-ink/10">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Answer at their pace</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                Questions appear one at a time. They take a breath, hit record, and answer — no live pressure, no awkward calls.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-ink/10">
              <h3 className="font-heading font-semibold text-lg text-ink mb-2">Submit and done</h3>
              <p className="text-gray-mid text-sm leading-relaxed">
                One click to submit. Their interview goes straight to the recruiter's dashboard — fully scored and ready to review.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-ink tracking-tight">
              Simple pricing that pays for itself
            </h2>
            <p className="mt-3 text-gray-mid">No contracts. No setup fees. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-stretch">

            {/* Starter */}
            <div className="bg-white rounded-2xl border border-gray-soft p-6 flex flex-col">
              <div className="font-heading font-bold text-lg text-ink">Starter</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading font-bold text-4xl text-ink tracking-tight">₹9,999</span>
                <span className="text-sm text-gray-mid">/month</span>
              </div>
              <div className="text-sm font-semibold text-violet mt-1">up to 100 candidates / month</div>
              <hr className="my-4 border-gray-soft" />
              <p className="text-sm italic text-violet leading-relaxed mb-5">"Your first AI recruiter. No salary required."</p>
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; 3 active roles</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Run interviews for up to 3 positions simultaneously</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Fully automated screening</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">100 candidates screened while you slept</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; AI writes your questions</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Describe the role. Done. No HR degree needed.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Video interviews on autopilot</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Candidates record on their time. You watch when you're ready.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Auto-scoring & full transcript</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Every candidate scored out of 10. Automatically. Before your morning coffee.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Basic speech analysis</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">See how fast they talk and how clearly they communicate</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Email support</p>
                </div>
              </div>
              <div className="mt-6">
                <Link href="/login" className="block border-2 border-violet text-violet text-center font-semibold text-sm py-2.5 rounded-xl hover:bg-violet hover:text-white transition-colors">
                  Start Free Trial
                </Link>
                <Link href="/upgrade?plan=starter" className="block text-center text-sm text-violet hover:underline mt-2">
                  Buy Now →
                </Link>
              </div>
            </div>

            {/* Growth */}
            <div className="bg-ink rounded-2xl p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow text-ink text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap font-heading tracking-wide">
                MOST POPULAR
              </div>
              <div className="font-heading font-bold text-lg text-white">Growth</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading font-bold text-4xl text-white tracking-tight">₹24,999</span>
                <span className="text-sm text-gray-mid">/month</span>
              </div>
              <div className="text-sm font-semibold text-yellow mt-1">up to 500 candidates / month</div>
              <hr className="my-4 border-gray-mid opacity-20" />
              <p className="text-sm italic text-lavender leading-relaxed mb-5">"Hire like a company 10x your size."</p>
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Unlimited roles</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">No caps. Hire for every position, all at once.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Screening at scale</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Scale your screening without scaling your team</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Full sentiment analysis</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Know if they're confident, nervous, or telling you what you want to hear</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Advanced AI score breakdown</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">A full breakdown by communication, clarity, and confidence</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; CSV bulk invites</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Upload 500 emails. Send 500 invites. One click.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Interview progress dashboard</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">See who's done, who's pending, who ghosted</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; 3 team logins</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Your whole hiring team, one account</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">✓&nbsp; Same-day priority support</p>
                </div>
              </div>
              <div className="mt-6">
                <Link href="/login" className="block bg-violet text-white text-center font-semibold text-sm py-2.5 rounded-xl hover:bg-violet-dark transition-colors">
                  Start Free Trial
                </Link>
                <Link href="/upgrade?plan=growth" className="block text-center text-sm text-yellow hover:underline mt-2">
                  Buy Now →
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl border border-gray-soft p-6 flex flex-col">
              <div className="font-heading font-bold text-lg text-ink">Enterprise</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading font-bold text-4xl text-ink tracking-tight">Custom</span>
              </div>
              <div className="text-sm font-semibold text-violet mt-1">unlimited candidates / month</div>
              <hr className="my-4 border-gray-soft" />
              <p className="text-sm italic text-violet leading-relaxed mb-5">"Your recruiting team just got a lot bigger."</p>
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Unlimited everything</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Roles, interviews, candidates. No ceilings, ever.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Unlimited team logins</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Bring your whole recruiting org on board</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Custom integrations</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Connect Recrewt to your existing ATS and tools</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Dedicated account manager</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">A real human, not a ticket queue</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Single sign-on (SSO)</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">Enterprise-grade login for your whole team</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Advanced reporting</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">See exactly where your hiring wins and where it leaks</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Priority feature access</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">You tell us what you need. We build it next.</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">✓&nbsp; Custom onboarding & training</p>
                  <p className="text-xs text-gray-mid mt-0.5 ml-4 leading-relaxed">We set your team up to win, hands-on</p>
                </div>
              </div>
              <div className="mt-6">
                <a href="https://calendly.com/your-handle/recrewt-demo" target="_blank" rel="noopener noreferrer" className="block border-2 border-ink text-ink text-center font-semibold text-sm py-2.5 rounded-xl hover:bg-ink hover:text-white transition-colors">
                  Talk to Sales
                </a>
                <p className="text-center text-xs text-gray-mid mt-2">Scoped to your needs. Volume pricing available.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="book-demo" className="py-20 px-6 lg:px-8 bg-ink">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-white tracking-tight">
            Ready to hire smarter?
          </h2>
          <p className="mt-3 text-gray-soft">
            Book a 15-minute demo or start your free trial today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="inline-flex items-center gap-2 bg-violet text-white font-heading font-semibold px-6 py-3.5 rounded-lg hover:bg-violet-dark transition-colors">
              Start Free Trial
              <ArrowRight size={18} />
            </Link>
            <a href="https://calendly.com/your-handle/recrewt-demo" className="inline-flex items-center gap-2 bg-white text-ink font-heading font-semibold px-6 py-3.5 rounded-lg hover:bg-yellow transition-colors">
              <Calendar size={18} />
              Book Demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 lg:px-8 border-t border-gray-soft">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={16} />
            </div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-gray-mid hover:text-ink transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:support@recrewtai.com" className="text-sm text-gray-mid hover:text-ink transition-colors">
              Contact
            </a>
          </div>
          <p className="text-sm text-gray-mid">
            © 2026 Recrewt AI. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}