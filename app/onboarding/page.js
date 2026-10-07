'use client'

/**
 * Onboarding — the first screen after a new account signs in.
 *
 * It used to be a three-step wizard from the very first version of the
 * product: type a job title, accept AI questions, then email a real
 * candidate, and only then were you allowed into the app. A recruiter
 * who just wanted to look around was made to send an interview invite
 * to somebody before seeing a single screen.
 *
 * Now it does two things: shows how Recrewt works, in the order the
 * recruiter will actually do it, and asks the two facts every invite
 * email needs (who's sending it, and from which company). Then it gets
 * out of the way and drops them on Clients, where step 1 starts.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ScanFace, ArrowRight, Building2, FileText, Send, CheckCircle2, Sparkles, Loader2, Video,
} from 'lucide-react'

/* ── Small visuals, one per step. Plain markup, so they match the app. ── */

function Chip({ children, strong = false }) {
  return (
    <div
      className={
        'flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-[12.5px] ' +
        (strong
          ? 'border-[color:var(--color-rc-ink)] bg-white text-[color:var(--color-rc-ink)]'
          : 'border-[color:var(--color-rc-line)] bg-white text-[color:var(--color-rc-muted)]')
      }
    >
      {children}
    </div>
  )
}

function VisualClients() {
  return (
    <div className="grid gap-1.5">
      <Chip strong><span className="font-medium">Sony</span><span>3 roles</span></Chip>
      <Chip><span>Northwind Studio</span><span>1 role</span></Chip>
      <Chip><span>Brightpath Health</span><span>2 roles</span></Chip>
    </div>
  )
}

function VisualJD() {
  return (
    <div className="grid gap-1.5">
      <Chip>
        <span className="inline-flex items-center gap-2 min-w-0">
          <FileText size={13} aria-hidden="true" />
          <span className="truncate">Graphic_Designer_JD.pdf</span>
        </span>
        <CheckCircle2 size={13} className="shrink-0 text-[color:var(--color-rc-green)]" aria-hidden="true" />
      </Chip>
      <div className="rounded-[10px] border border-[color:var(--color-rc-line)] bg-white px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[color:var(--color-rc-warm)]">
          <Sparkles size={11} aria-hidden="true" /> 8 questions drafted
        </div>
        <div className="mt-1.5 text-[12.5px] text-[color:var(--color-rc-ink)] leading-snug">
          “Walk me through a brand refresh you led…”
        </div>
      </div>
    </div>
  )
}

function VisualInvite() {
  return (
    <div className="grid gap-1.5">
      <Chip>
        <span className="inline-flex items-center gap-2"><Send size={13} aria-hidden="true" /> 25 CVs uploaded</span>
        <span>25 emails found</span>
      </Chip>
      <Chip>
        <span className="inline-flex items-center gap-2"><Video size={13} aria-hidden="true" /> Priya is interviewing</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-green)]" aria-hidden="true" /> live
        </span>
      </Chip>
    </div>
  )
}

function VisualReview() {
  return (
    <div className="grid gap-1.5">
      <Chip strong>
        <span className="font-medium">Priya Nair</span>
        <span className="inline-flex items-center gap-2">
          <span className="tabular-nums font-semibold">8.4</span>
          <span className="rounded-full bg-[color:var(--color-rc-soft)] px-2 py-0.5 text-[11px]">Suggest shortlist</span>
        </span>
      </Chip>
      <Chip>
        <span>Daniel Ross</span>
        <span className="tabular-nums">6.1</span>
      </Chip>
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    icon: Building2,
    title: 'Add your clients',
    body: 'Each company you hire for gets its own space. Two clients can both need a graphic designer and nothing gets mixed up.',
    Visual: VisualClients,
  },
  {
    n: '02',
    icon: FileText,
    title: 'Drop in the job description',
    body: 'Recrewt reads the JD, pulls out what the role really needs and drafts the interview questions. You tweak what you want.',
    Visual: VisualJD,
  },
  {
    n: '03',
    icon: Send,
    title: 'Invite candidates',
    body: 'Upload a pile of CVs and the emails get picked up for you. Candidates do a video interview whenever suits them, the AI asks follow ups like a real interviewer would.',
    Visual: VisualInvite,
  },
  {
    n: '04',
    icon: CheckCircle2,
    title: 'Read the good ones',
    body: 'Every interview comes back with a transcript, a score and the answers that earned it. The AI suggests, you decide who moves on.',
    Visual: VisualReview,
  },
]

/* ── Page ──────────────────────────────────────────────────────────── */

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  // Prefill from the account (Google sign-in gives us a name) and from
  // anything they already saved, so nobody types their name twice.
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: s } = await supabase
        .from('settings').select('full_name, company_name, onboarding_completed')
        .eq('user_id', user.id).maybeSingle()
      if (!live) return
      if (s?.onboarding_completed) { router.replace('/dashboard'); return }
      const meta = user.user_metadata || {}
      setFullName(s?.full_name || meta.full_name || meta.name || '')
      setCompany(s?.company_name || '')
      setEmail(user.email || '')
      setReady(true)
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finish(e) {
    e?.preventDefault()
    const name = fullName.trim()
    const comp = company.trim()
    if (!name) { setError('Add your name. Candidates see it on their invite.'); return }
    if (!comp) { setError('Add your company name. It goes on every invite email.'); return }
    setError('')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { error: saveErr } = await supabase
      .from('settings')
      .update({ full_name: name, company_name: comp, onboarding_completed: true })
      .eq('user_id', user.id)

    if (saveErr) {
      console.error('onboarding save:', saveErr)
      setError('That didn’t save. Try again in a moment.')
      setSaving(false)
      return
    }

    // Lets Mike know someone new is in. Never blocks the user.
    fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, name, company: comp }),
    }).catch(() => {})

    router.push('/clients')
  }

  const inputCls =
    'w-full h-11 rounded-[10px] border border-[color:var(--color-rc-line)] bg-white px-3.5 ' +
    'text-[14.5px] text-[color:var(--color-rc-ink)] placeholder:text-[color:var(--color-rc-muted)] ' +
    'hover:border-[color:var(--color-rc-line-hover)] focus:border-[color:var(--color-rc-ink)] focus:outline-none transition-colors'

  return (
    <div className="min-h-screen bg-[color:var(--color-rc-bg)] text-[color:var(--color-rc-ink)]">
      <style>{`
        @keyframes rc-onb-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .rc-onb-in { animation: rc-onb-in .55s cubic-bezier(.22,.61,.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .rc-onb-in { animation: none; } }
      `}</style>

      {/* Top bar */}
      <header className="max-w-[1120px] mx-auto px-6 pt-8 flex items-center gap-2.5">
        <span aria-hidden="true" className="h-7 w-7 rounded-[8px] bg-[color:var(--color-rc-ink)] grid place-items-center">
          <ScanFace className="text-[color:var(--color-rc-yellow)]" size={15} strokeWidth={2} />
        </span>
        <span className="text-[15.5px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-editorial), inherit' }}>
          Recrewt AI
        </span>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 pt-14 pb-20">
        {/* Intro */}
        <div className="max-w-[640px] rc-onb-in">
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
            Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''}
          </div>
          <h1
            className="mt-3 text-[34px] md:text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            Candidates interview themselves. You read the good ones.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-[color:var(--color-rc-muted)]">
            Here&rsquo;s the whole thing in four steps. It takes about ten minutes to get your first role out.
          </p>
        </div>

        {/* The four steps */}
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const Visual = s.Visual
            return (
              <li
                key={s.n}
                className="rc-onb-in flex flex-col rounded-[18px] border border-[color:var(--color-rc-line)] bg-white p-5"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[13px] font-semibold tabular-nums text-[color:var(--color-rc-muted)]"
                    style={{ fontFamily: 'var(--font-editorial), inherit' }}
                  >
                    {s.n}
                  </span>
                  <span className="h-8 w-8 grid place-items-center rounded-[9px] bg-[color:var(--color-rc-soft)]">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                </div>
                <h2
                  className="mt-4 text-[18px] leading-tight font-semibold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-editorial), inherit' }}
                >
                  {s.title}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                  {s.body}
                </p>
                <div className="mt-auto pt-5">
                  <div className="rounded-[12px] bg-[color:var(--color-rc-soft)] p-2.5">
                    <Visual />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {/* Workspace setup */}
        <section
          className="rc-onb-in mt-12 rounded-[20px] border border-[color:var(--color-rc-line)] bg-white p-6 md:p-8 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8"
          style={{ animationDelay: '520ms' }}
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Last thing
            </div>
            <h2
              className="mt-2 text-[24px] leading-tight font-semibold tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Set up your workspace
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-muted)]">
              Candidates see these on every invite, so they know who&rsquo;s reaching out. You can change them later in Settings.
            </p>
          </div>

          <form onSubmit={finish} className="grid gap-4" noValidate>
            <div>
              <label htmlFor="onb-name" className="block mb-1.5 text-[13px] font-medium">Your name</label>
              <input
                id="onb-name" className={inputCls} value={fullName} disabled={!ready}
                onChange={(e) => { setFullName(e.target.value); if (error) setError('') }}
                placeholder="Sarah Thomas" autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="onb-company" className="block mb-1.5 text-[13px] font-medium">Your company</label>
              <input
                id="onb-company" className={inputCls} value={company} disabled={!ready}
                onChange={(e) => { setCompany(e.target.value); if (error) setError('') }}
                placeholder="Talent Bridge Recruitment" autoComplete="organization"
              />
              <p className="mt-1.5 text-[12.5px] text-[color:var(--color-rc-muted)]">
                Your agency or business. The companies you hire for go in Clients, next.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-[color:var(--color-rc-red)]">{error}</p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <span className="text-[12.5px] text-[color:var(--color-rc-muted)] truncate">
                {email ? <>Signed in as {email}</> : ' '}
              </span>
              <button
                type="submit"
                disabled={saving || !ready}
                className={
                  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[10px] ' +
                  'bg-[color:var(--color-rc-ink)] text-white text-[14px] font-medium ' +
                  'hover:bg-black disabled:opacity-60 transition-colors ' +
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2'
                }
              >
                {saving
                  ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Setting up</>
                  : <>Add my first client <ArrowRight size={15} aria-hidden="true" /></>}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}
