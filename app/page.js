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
      <section id="pricing" className="py-20 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-ink tracking-tight">
              Simple pricing
            </h2>
            <p className="mt-3 text-gray-mid">
              Start free. Upgrade when you're ready.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-soft flex flex-col">
              <div className="mb-6">
                <h3 className="font-heading font-semibold text-lg text-ink">Starter</h3>
                <p className="text-sm text-gray-mid mt-1">For solo recruiters trying it out.</p>
              </div>
              <div className="mb-6">
                <span className="font-heading font-bold text-4xl text-ink">$XX</span>
                <span className="text-gray-mid"> /month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />Up to 3 active roles</li>
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />20 candidate interviews / month</li>
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />AI scoring & transcripts</li>
              </ul>
              <Link href="/login" className="block text-center bg-white border border-ink text-ink font-medium py-2.5 rounded-lg hover:bg-ink hover:text-white transition-colors">
                Start Free Trial
              </Link>
            </div>

            <div className="bg-ink rounded-2xl p-8 border-2 border-violet flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most Popular
              </span>
              <div className="mb-6">
                <h3 className="font-heading font-semibold text-lg text-white">Growth</h3>
                <p className="text-sm text-gray-soft mt-1">For growing hiring teams.</p>
              </div>
              <div className="mb-6">
                <span className="font-heading font-bold text-4xl text-white">$XX</span>
                <span className="text-gray-soft"> /month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-2 text-sm text-white"><Check size={18} className="text-yellow shrink-0 mt-0.5" />Unlimited roles</li>
                <li className="flex items-start gap-2 text-sm text-white"><Check size={18} className="text-yellow shrink-0 mt-0.5" />200 candidate interviews / month</li>
                <li className="flex items-start gap-2 text-sm text-white"><Check size={18} className="text-yellow shrink-0 mt-0.5" />Team collaboration & sharing</li>
                <li className="flex items-start gap-2 text-sm text-white"><Check size={18} className="text-yellow shrink-0 mt-0.5" />Priority email support</li>
              </ul>
              <Link href="/login" className="block text-center bg-violet text-white font-medium py-2.5 rounded-lg hover:bg-violet-dark transition-colors">
                Start Free Trial
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-soft flex flex-col">
              <div className="mb-6">
                <h3 className="font-heading font-semibold text-lg text-ink">Enterprise</h3>
                <p className="text-sm text-gray-mid mt-1">For large teams with custom needs.</p>
              </div>
              <div className="mb-6">
                <span className="font-heading font-bold text-4xl text-ink">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />Unlimited interviews</li>
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />SSO & advanced security</li>
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />Dedicated success manager</li>
                <li className="flex items-start gap-2 text-sm text-ink"><Check size={18} className="text-violet shrink-0 mt-0.5" />Custom integrations</li>
              </ul>
              <a href="#book-demo" className="block text-center bg-white border border-ink text-ink font-medium py-2.5 rounded-lg hover:bg-ink hover:text-white transition-colors">
                Contact Sales
              </a>
            </div>
          </div>

          <p className="text-center text-sm text-gray-mid mt-8">
            Prices are placeholders — final pricing coming soon.
          </p>
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