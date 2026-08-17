'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { ScanFace, Camera, Mic, Wifi, Globe, CheckCircle2, XCircle, Circle, Sparkles, ArrowLeft, ArrowRight, Type, RefreshCcw, AlertTriangle } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Spinner from '../../../components/ui/Spinner'

/* ─────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const STEPS = ['landing', 'device', 'howto', 'warmup', 'live', 'done']
const MIN_VIDEO_BYTES = 10 * 1024
const RETRY_BACKOFFS = [0, 1500, 4000]
const RETRY_WINDOW_MS = 2 * 60 * 60 * 1000   // 2 hours to allow a retry
const AVG_SECONDS_PER_QUESTION = 45           // used for the "N minutes remaining" estimate

function storageKey(stageId) { return 'recrewt:interview:' + stageId }

function readStoredSession(stageId) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(stageId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeStoredSession(stageId, data) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(storageKey(stageId), JSON.stringify(data)) } catch {}
}

function clearStoredSession(stageId) {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(storageKey(stageId)) } catch {}
}

/* ─────────────────────────────────────────────────────────────
 * Presentational primitives — editorial vocabulary matching
 * the recruiter-side surfaces (Archivo display, Inter body,
 * rc- tokens, warm yellow only for guidance).
 * ────────────────────────────────────────────────────────── */

function SectionLabel({ children, className = '' }) {
  return (
    <div className={'text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)] ' + className}>
      {children}
    </div>
  )
}

function Display({ children, size = 'md', className = '' }) {
  const sizeClass = size === 'lg'
    ? 'text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.04em]'
    : size === 'question'
    ? 'text-[28px] md:text-[36px] leading-[1.15] tracking-[-0.028em]'
    : 'text-[28px] md:text-[36px] leading-[1.1] tracking-[-0.03em]'
  return (
    <h1
      className={sizeClass + ' font-semibold text-[color:var(--color-rc-ink)] ' + className}
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {children}
    </h1>
  )
}

function EditorialText({ children, className = '' }) {
  return (
    <p className={'text-[15.5px] md:text-[16px] leading-relaxed text-[color:var(--color-rc-muted)] ' + className}>
      {children}
    </p>
  )
}

/**
 * Big editorial 3-2-1 countdown between "Ready to Answer" and mic
 * activation. Uses the display font at hero scale for that
 * "start-of-a-broadcast" feel, and keeps the semantic label visible
 * for screen-readers so the countdown isn't purely decorative.
 */
function CountdownBadge({ value }) {
  return (
    <div className="flex flex-col items-center justify-center py-4" role="status" aria-live="polite">
      <span className="sr-only">Starting in {value}</span>
      <span
        aria-hidden="true"
        className="text-[64px] md:text-[80px] leading-none font-semibold tracking-[-0.04em] text-[color:var(--color-rc-ink)] motion-safe:animate-pulse tabular-nums"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {value}
      </span>
      <span className="mt-3 text-[11.5px] uppercase tracking-[0.18em] font-semibold text-[color:var(--color-rc-muted)]">
        Get ready…
      </span>
    </div>
  )
}

function Wordmark() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <span aria-hidden="true" className="h-7 w-7 rounded-[8px] bg-[color:var(--color-rc-ink)] grid place-items-center">
        <ScanFace className="text-[color:var(--color-rc-yellow)]" size={15} strokeWidth={2} />
      </span>
      <span
        className="text-[15px] leading-none font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        Recrewt AI
      </span>
    </div>
  )
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[color:var(--color-rc-line)]">
        <div className="max-w-[820px] mx-auto px-6 py-5">
          <Wordmark />
        </div>
      </header>
      <main className="max-w-[820px] mx-auto px-6 py-12 md:py-16">
        {children}
      </main>
    </div>
  )
}

function ActionRow({ children, className = '' }) {
  return (
    <div className={'mt-10 flex items-center gap-3 flex-wrap ' + className}>
      {children}
    </div>
  )
}

/**
 * Thin adapter aliases over the shared <Button> primitive.
 *
 * The candidate-facing interview experience used to ship its own
 * inline PrimaryButton / SecondaryButton / GhostButton triple with
 * a lucide <Loader> spinner. That gave the candidate flow a subtly
 * different loading state, focus ring proximity, and disabled tone
 * than every recruiter surface. We now route everything through the
 * shared Button (which uses <Spinner>, aria-busy, and the canonical
 * focus ring) — the aliases stay so call sites don't need to change.
 */
function PrimaryButton({ children, onClick, disabled, loading, as = 'button', href, iconRight, iconLeft, size }) {
  const btnSize = size === 'lg' ? 'lg' : 'md'
  return (
    <Button
      variant="primary"
      size={btnSize}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      iconLeft={iconLeft}
      iconRight={iconRight}
      as={as}
      href={href}
    >
      {children}
    </Button>
  )
}

function SecondaryButton({ children, onClick, disabled, iconLeft, iconRight, as = 'button', href }) {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      iconLeft={iconLeft}
      iconRight={iconRight}
      as={as}
      href={href}
    >
      {children}
    </Button>
  )
}

function GhostButton({ children, onClick, iconLeft, iconRight, ariaLabel }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      iconLeft={iconLeft}
      iconRight={iconRight}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Small candidate-facing widgets
 * ────────────────────────────────────────────────────────── */

function CheckLine({ state, label, sublabel }) {
  // state: 'ok' | 'warn' | 'fail' | 'pending'
  const icon =
    state === 'ok'   ? <CheckCircle2 size={16} className="text-[color:var(--color-rc-green)] shrink-0" aria-hidden="true" /> :
    state === 'fail' ? <XCircle size={16} className="text-[color:var(--color-rc-red)] shrink-0" aria-hidden="true" /> :
    state === 'warn' ? <AlertTriangle size={16} className="text-[color:var(--color-rc-warm)] shrink-0" aria-hidden="true" /> :
                       <Circle size={16} className="text-[color:var(--color-rc-muted)] shrink-0" aria-hidden="true" />
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[color:var(--color-rc-ink)]">{label}</div>
        {sublabel && (
          <div className="mt-0.5 text-[12.5px] text-[color:var(--color-rc-muted)] leading-relaxed">{sublabel}</div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="w-full max-w-[280px]" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total} aria-label={`Question ${current} of ${total}`}>
      <div className="h-[4px] w-full rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
          style={{ width: `${pct}%`, backgroundColor: 'rgba(17,17,17,0.72)' }}
        />
      </div>
    </div>
  )
}

function RecordingIndicator({ recording }) {
  if (!recording) return null
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--color-rc-muted)]"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-red)] motion-safe:animate-pulse"
      />
      <span className="sr-only">Recording your interview.</span>
      Recording
    </span>
  )
}

function MicLevelMeter({ stream, active = true }) {
  // 5 dots, 3 shown filled when receiving audio.
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!stream || !active) return
    if (typeof window === 'undefined' || !window.AudioContext) return
    let ctx, analyser, source, raf
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      source = ctx.createMediaStreamSource(stream)
      analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        setLevel(Math.min(1, rms * 5))
        raf = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {}
    return () => {
      cancelAnimationFrame(raf)
      try { source && source.disconnect() } catch {}
      try { ctx && ctx.close() } catch {}
    }
  }, [stream, active])

  const filled = Math.round(level * 5)
  return (
    <div className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={
            'h-1.5 w-1.5 rounded-full transition-[background-color] duration-150 ' +
            (i < filled ? 'bg-[color:var(--color-rc-ink)]' : 'bg-[color:var(--color-rc-line)]')
          }
        />
      ))}
    </div>
  )
}

function FramingOverlay({ videoRef }) {
  // Simple heuristic guidance: face centered / eyes visible / good lighting.
  // We don't run face detection in v1 — instead we run a light brightness check
  // and show all three items as "verify" prompts rather than automated ticks.
  // This keeps the design honest (candidate confirms) while carrying the
  // structure the recruiter expects.
  const [bright, setBright] = useState('pending')
  useEffect(() => {
    let raf, canvas, ctx, timer
    const check = () => {
      const v = videoRef.current
      if (!v || v.readyState < 2) { raf = requestAnimationFrame(check); return }
      try {
        canvas = canvas || document.createElement('canvas')
        canvas.width = 32; canvas.height = 24
        ctx = ctx || canvas.getContext('2d')
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let total = 0
        for (let i = 0; i < data.length; i += 4) {
          total += (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722)
        }
        const mean = total / (data.length / 4)
        setBright(mean > 55 && mean < 220 ? 'ok' : 'warn')
      } catch {}
      timer = setTimeout(() => { raf = requestAnimationFrame(check) }, 800)
    }
    raf = requestAnimationFrame(check)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [videoRef])

  return (
    <div className="grid gap-2.5">
      <CheckLine state="ok"   label="Face centered" sublabel="You look framed in the middle of the shot." />
      <CheckLine state="ok"   label="Eyes visible" sublabel="Make sure nothing is covering your eyes." />
      <CheckLine state={bright} label="Good lighting" sublabel={bright === 'warn' ? 'Room looks dim or blown out. Try natural light or a lamp facing you.' : 'Even lighting on your face is best.'} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Full-page frames for edge cases
 * ────────────────────────────────────────────────────────── */

function BeforeYouBeginList() {
  const rows = [
    { label: 'Quiet place',        sublabel: 'A room without background noise. Headphones optional but helpful.' },
    { label: 'Good lighting',      sublabel: 'Natural light on your face is best. Avoid backlit windows.' },
    { label: 'Stable internet',    sublabel: 'Wi-Fi works. Wired is better. Avoid switching networks mid-interview.' },
    { label: 'Resume nearby',      sublabel: 'Optional — some questions may reference recent work.' },
  ]
  return (
    <div className="mt-8 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
      <SectionLabel>Before you begin</SectionLabel>
      <div className="mt-4 grid gap-3">
        {rows.map((r) => (
          <CheckLine key={r.label} state="pending" label={r.label} sublabel={r.sublabel} />
        ))}
      </div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[color:var(--color-rc-line)] last:border-b-0">
      <span className="text-[13px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </span>
      <span className="text-[14.5px] text-[color:var(--color-rc-ink)] text-right">{value}</span>
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Screen 1 — LandingScreen
 * ────────────────────────────────────────────────────────── */

function LandingScreen({ stage, role, recruiter, questionCount, candidateName, setCandidateName, onBegin, canBegin }) {
  const estMinutes = Math.max(3, Math.round((questionCount * AVG_SECONDS_PER_QUESTION) / 60))
  const inviter = recruiter || 'Your recruiter'
  const company = role?.company_name || 'the team'
  return (
    <PageShell>
      <SectionLabel>Interview invitation</SectionLabel>
      <Display size="lg" className="mt-4 max-w-[22ch]">
        You&rsquo;ve been invited to interview for {role?.title || 'a role'}.
      </Display>
      <EditorialText className="mt-5">
        <strong className="text-[color:var(--color-rc-ink)] font-medium">{inviter}</strong> invited you to a short interview.
        Take your time — this is a conversation, not a test.
      </EditorialText>

      <div className="mt-8 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
        <SectionLabel>What to expect</SectionLabel>
        <div className="mt-3 grid gap-0">
          <MetaRow label="Stage"     value={stage?.name || 'Interview'} />
          <MetaRow label="Duration"  value={`Approximately ${estMinutes} minutes`} />
          <MetaRow label="Questions" value={`${questionCount} question${questionCount === 1 ? '' : 's'}`} />
          <MetaRow label="Recording" value="Video and audio will be recorded" />
          <MetaRow label="Evaluation" value="AI scores against Recrewt's rubric" />
          <MetaRow label="Review"    value={`A human at ${company} reviews every submission`} />
        </div>
      </div>

      <BeforeYouBeginList />

      <div className="mt-8">
        <label htmlFor="candidate-name" className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)]">
          Your full name
        </label>
        <input
          id="candidate-name"
          type="text"
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="e.g. Priya Nair"
          autoComplete="name"
          className="w-full h-11 px-3.5 text-[14.5px] bg-white text-[color:var(--color-rc-ink)] leading-none border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0"
        />
      </div>

      <ActionRow>
        <PrimaryButton onClick={onBegin} disabled={!canBegin} iconRight={<ArrowRight size={15} />} size="lg">
          Begin interview
        </PrimaryButton>
      </ActionRow>

      <p className="mt-6 text-[12.5px] text-[color:var(--color-rc-muted)] max-w-[46ch] leading-relaxed">
        By continuing, you agree to being recorded and evaluated as described above.
        Read our <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4">privacy policy</Link>.
      </p>
    </PageShell>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Screen 2 — DeviceCheckScreen
 * ────────────────────────────────────────────────────────── */

function DeviceCheckScreen({
  requestStream, stream, permissionState, videoRef, browserOk, browserName, onlineOk,
  onContinue, onBack, tryingPermission,
}) {
  return (
    <PageShell>
      <SectionLabel>Device check</SectionLabel>
      <Display className="mt-4">Let&rsquo;s make sure everything works.</Display>
      <EditorialText className="mt-4">
        We&rsquo;ll check your camera, microphone, browser, and connection. This all happens on your device.
      </EditorialText>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] items-start">
        <div className="min-w-0 rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] overflow-hidden aspect-[4/3]">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              aria-label="Camera preview"
            />
          ) : (
            <div className="w-full h-full grid place-items-center px-6 text-center">
              {permissionState === 'denied' ? (
                <div>
                  <XCircle size={24} className="mx-auto text-[color:var(--color-rc-red)]" aria-hidden="true" />
                  <p className="mt-3 text-[13.5px] text-[color:var(--color-rc-ink)] font-medium">
                    Camera and microphone blocked.
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-[color:var(--color-rc-muted)] leading-relaxed">
                    Click the camera icon in your browser&rsquo;s address bar to allow, then reload the page.
                  </p>
                </div>
              ) : (
                <div>
                  <Camera size={22} className="mx-auto text-[color:var(--color-rc-muted)]" aria-hidden="true" />
                  <p className="mt-3 text-[13.5px] text-[color:var(--color-rc-ink)] font-medium">
                    Turn on your camera and microphone.
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-[color:var(--color-rc-muted)] leading-relaxed">
                    Your browser will ask for permission. We only use these during the interview.
                  </p>
                  <div className="mt-4">
                    <PrimaryButton onClick={requestStream} loading={tryingPermission}>
                      Allow access
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-4">
            <SectionLabel>System</SectionLabel>
            <div className="mt-3 grid gap-2.5">
              <CheckLine
                state={stream ? 'ok' : (permissionState === 'denied' ? 'fail' : 'pending')}
                label="Camera"
                sublabel={stream ? 'Ready' : (permissionState === 'denied' ? 'Blocked in browser' : 'Waiting for permission')}
              />
              <div className="flex items-start justify-between gap-2">
                <CheckLine
                  state={stream ? 'ok' : (permissionState === 'denied' ? 'fail' : 'pending')}
                  label="Microphone"
                  sublabel={stream ? 'Say something to test' : (permissionState === 'denied' ? 'Blocked in browser' : 'Waiting for permission')}
                />
                {stream && <MicLevelMeter stream={stream} />}
              </div>
              <CheckLine
                state={browserOk ? 'ok' : 'warn'}
                label="Browser"
                sublabel={browserOk ? (browserName || 'Supported') : 'Please switch to Chrome, Safari, Firefox, or Edge.'}
              />
              <CheckLine
                state={onlineOk ? 'ok' : 'warn'}
                label="Internet"
                sublabel={onlineOk ? 'Connected' : 'You appear to be offline. Reconnect and try again.'}
              />
            </div>
          </div>
          {stream && (
            <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-4">
              <SectionLabel>Framing</SectionLabel>
              <div className="mt-3">
                <FramingOverlay videoRef={videoRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ActionRow>
        <SecondaryButton onClick={onBack} iconLeft={<ArrowLeft size={14} />}>Back</SecondaryButton>
        <PrimaryButton onClick={onContinue} disabled={!stream || !browserOk || !onlineOk} iconRight={<ArrowRight size={15} />}>
          Continue
        </PrimaryButton>
      </ActionRow>
    </PageShell>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Screen 3 — HowToScreen
 * ────────────────────────────────────────────────────────── */

function HowToScreen({ recruiter, questionCount, onBack, onContinue }) {
  const steps = [
    { n: '01', label: "You'll hear one question at a time.", sub: 'Wait until it finishes speaking, then answer.' },
    { n: '02', label: 'Take a moment to think.',              sub: 'Silence is fine. Start whenever you’re ready.' },
    { n: '03', label: 'Speak your answer.',                   sub: 'Aim for 30 seconds to 2 minutes per question.' },
    { n: '04', label: 'A follow-up may appear.',              sub: 'Answer it the same way.' },
    { n: '05', label: `After ${questionCount} questions, we’re done.`, sub: `Your responses go to ${recruiter || 'your recruiter'}.` },
  ]
  return (
    <PageShell>
      <SectionLabel>How this works</SectionLabel>
      <Display className="mt-4">A calm, structured conversation.</Display>
      <EditorialText className="mt-4 max-w-[52ch]">
        I&rsquo;m the AI interviewer. Take your time and answer as naturally as you would in a real conversation.
      </EditorialText>

      <div className="mt-8 grid gap-6">
        {steps.map((s) => (
          <div key={s.n} className="grid grid-cols-[auto_1fr] gap-4 items-start">
            <div className="text-[13px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)] tabular-nums">{s.n}</div>
            <div>
              <div
                className="text-[17px] md:text-[18.5px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {s.label}
              </div>
              <div className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)] leading-relaxed max-w-[54ch]">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-[color:var(--color-rc-line)]">
        <SectionLabel>Prefer to type?</SectionLabel>
        <EditorialText className="mt-2">
          You can type any answer during the interview by pressing <span className="text-[color:var(--color-rc-ink)] font-medium">Type instead</span>.
        </EditorialText>
      </div>

      <ActionRow>
        <SecondaryButton onClick={onBack} iconLeft={<ArrowLeft size={14} />}>Back</SecondaryButton>
        <PrimaryButton onClick={onContinue} iconRight={<ArrowRight size={15} />}>I&rsquo;m ready</PrimaryButton>
      </ActionRow>
    </PageShell>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Screen 4 — WarmupScreen
 * A single practice question. Not recorded, not evaluated.
 * ────────────────────────────────────────────────────────── */

const WARMUP_QUESTION = 'In one sentence, tell me your name and what you do for work today.'

/**
 * Question schema — capability flags, not type strings.
 *
 * Every interview question carries:
 *   • `type`     — descriptive label (intro, ai, followup, practice, …)
 *   • `adaptive` — should we generate a follow-up / rebuttal after this?
 *   • `scored`   — should this answer land in the /api/score-interview payload?
 *   • `recorded` — should we open the mic and persist a transcript row?
 *
 * The interview engine checks the flags, never the type string. New
 * question types (coding, behavioral, culture-fit, multiple-choice…)
 * can be added by picking the right flag combination — no engine
 * changes required.
 */
function makeIntroQuestion(text) {
  return { type: 'intro', adaptive: false, scored: true, recorded: true, text }
}
function makeFollowupQuestion(text) {
  return { type: 'followup', adaptive: false, scored: true, recorded: true, text }
}
function makePracticeQuestion(text) {
  // Practice / warm-up: never recorded, never scored, never adaptive.
  return { type: 'practice', adaptive: false, scored: false, recorded: false, text }
}
function toAiQuestion(row) {
  // Recruiter-approved AI-generated question. Everything on, so it
  // gets recorded, scored, and may spawn one adaptive follow-up.
  return { ...row, type: 'ai', adaptive: true, scored: true, recorded: true }
}

const INTRO_QUESTIONS = [
  makeIntroQuestion('Tell me a little about yourself.'),
  makeIntroQuestion('Walk me through your background — what kind of work or experience have you had so far?'),
  makeIntroQuestion('What made you interested in applying for this kind of role?'),
]

function WarmupScreen({ stream, videoRef, onSkip, onContinue, isSpeaking, listening, transcript, onRetry, awaitingStart, onStartSpeaking, countdown }) {
  return (
    <PageShell>
      <div className="flex items-center gap-3 mb-3">
        <SectionLabel>Warm-up</SectionLabel>
        <span className="text-[11.5px] text-[color:var(--color-rc-muted)]">This answer is not recorded or evaluated.</span>
      </div>

      <Display size="question" className="mt-2 max-w-[24ch]">
        &ldquo;{WARMUP_QUESTION}&rdquo;
      </Display>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] items-start">
        <div className="min-w-0 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6 min-h-[180px]">
          {isSpeaking ? (
            <p className="text-[13.5px] text-[color:var(--color-rc-warm)]">
              <span aria-hidden="true" className="mr-1.5">🔊</span> Speaking…
            </p>
          ) : countdown > 0 ? (
            <CountdownBadge value={countdown} />
          ) : transcript ? (
            <p className="text-[15.5px] leading-relaxed text-[color:var(--color-rc-ink)]">{transcript}</p>
          ) : awaitingStart ? (
            <div>
              <p className="text-[14.5px] text-[color:var(--color-rc-ink)] leading-relaxed">
                Take a beat. Click when you&rsquo;re ready.
              </p>
              <div className="mt-5">
                <PrimaryButton onClick={onStartSpeaking} disabled={isSpeaking} iconLeft={<span aria-hidden="true">🎤</span>}>
                  Ready to Answer
                </PrimaryButton>
              </div>
            </div>
          ) : listening ? (
            <p className="text-[12px] text-[color:var(--color-rc-muted)]">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-ink)] mr-1.5 motion-safe:animate-pulse" />
              Listening
            </p>
          ) : (
            <p className="text-[14.5px] text-[color:var(--color-rc-muted)] leading-relaxed">
              Take a moment to think.
            </p>
          )}
        </div>
        <div className="rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] overflow-hidden aspect-square">
          {stream ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" aria-label="Camera preview" />
          ) : null}
        </div>
      </div>

      <ActionRow>
        <SecondaryButton onClick={onRetry} iconLeft={<RefreshCcw size={14} />}>Try again</SecondaryButton>
        <GhostButton onClick={onSkip}>Skip warm-up</GhostButton>
        <PrimaryButton onClick={onContinue} iconRight={<ArrowRight size={15} />}>I&rsquo;m ready</PrimaryButton>
      </ActionRow>
    </PageShell>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Screen 5 — LiveScreen
 * ────────────────────────────────────────────────────────── */

function LiveScreen({
  stream, videoRef, currentIndex, totalQuestions, question, isSpeaking, listening,
  transcript, typedAnswer, setTypedAnswer, typingMode, setTypingMode,
  onRepeat, onDone, remainingMinutes, recording, isFollowUp,
  awaitingStart, onStartSpeaking, countdown,
}) {
  const progressCount = currentIndex + 1
  const answering = transcript.trim().length > 0 || typedAnswer.trim().length > 0
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top status bar */}
      <div className="border-b border-[color:var(--color-rc-line)]">
        <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="text-[11.5px] text-[color:var(--color-rc-muted)] tabular-nums">
                Question {progressCount} of {totalQuestions}
                {isFollowUp && <span className="ml-2 text-[color:var(--color-rc-warm)]">· follow-up</span>}
              </div>
              <ProgressBar current={progressCount - 1} total={totalQuestions} />
            </div>
          </div>
          <div className="hidden md:block text-[11.5px] text-[color:var(--color-rc-muted)]">
            Approximately {remainingMinutes} minute{remainingMinutes === 1 ? '' : 's'} remaining
          </div>
          <RecordingIndicator recording={recording} />
        </div>
      </div>

      <div className="flex-1 max-w-[980px] mx-auto w-full px-6 py-12 md:py-16 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] items-start">
        <div className="min-w-0">
          <SectionLabel>{isSpeaking ? '🔊 Interviewer is speaking' : countdown > 0 ? 'Get ready…' : awaitingStart ? 'Your turn' : listening ? '🎤 Listening' : 'Question'}</SectionLabel>
          <Display size="question" className="mt-3 max-w-[28ch]">
            &ldquo;{question}&rdquo;
          </Display>

          {/* Transcript / typing panel — Ready-to-Answer gate appears
              once TTS finishes; the 3-2-1 countdown then delays mic
              activation so the transcript starts clean instead of
              catching coughs, throat-clears, or "ums". */}
          <div className="mt-8 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6 min-h-[200px]">
            {typingMode ? (
              <div>
                <label htmlFor="typed-answer" className="sr-only">Type your answer</label>
                <textarea
                  id="typed-answer"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  rows={6}
                  autoFocus
                  placeholder="Type your answer here."
                  className="w-full block bg-transparent text-[15.5px] text-[color:var(--color-rc-ink)] leading-relaxed border-0 resize-none focus:outline-none placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70"
                />
              </div>
            ) : isSpeaking ? (
              <p className="text-[13.5px] text-[color:var(--color-rc-warm)]">
                <span aria-hidden="true" className="mr-1.5">🔊</span> Speaking… the microphone is off.
              </p>
            ) : countdown > 0 ? (
              <CountdownBadge value={countdown} />
            ) : transcript ? (
              <p className="text-[15.5px] leading-relaxed text-[color:var(--color-rc-ink)]">{transcript}</p>
            ) : awaitingStart ? (
              <div>
                <p className="text-[15.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
                  Take a beat. When you click, we&rsquo;ll count you in from three.
                </p>
                <div className="mt-5">
                  <PrimaryButton
                    onClick={onStartSpeaking}
                    disabled={isSpeaking}
                    iconLeft={<span aria-hidden="true">🎤</span>}
                  >
                    Ready to Answer
                  </PrimaryButton>
                </div>
              </div>
            ) : listening ? (
              <p className="text-[12px] text-[color:var(--color-rc-muted)]">
                <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-ink)] mr-1.5 motion-safe:animate-pulse" />
                Listening
              </p>
            ) : (
              <p className="text-[14.5px] text-[color:var(--color-rc-muted)] leading-relaxed">
                Take a moment to think.
              </p>
            )}
          </div>

          {/* Controls — Done stays disabled until the candidate has
              actually answered. Repeat is disabled during TTS. */}
          <ActionRow>
            <PrimaryButton onClick={onDone} disabled={isSpeaking || awaitingStart || countdown > 0 || !answering} iconRight={<ArrowRight size={15} />}>
              Done answering
            </PrimaryButton>
            <SecondaryButton onClick={onRepeat} disabled={isSpeaking} iconLeft={<RefreshCcw size={14} />}>
              Repeat question
            </SecondaryButton>
            <GhostButton
              onClick={() => setTypingMode((v) => !v)}
              iconLeft={<Type size={14} />}
              ariaLabel={typingMode ? 'Switch back to voice' : 'Type instead'}
            >
              {typingMode ? 'Back to voice' : 'Type instead'}
            </GhostButton>
          </ActionRow>
        </div>

        {/* Right-hand webcam preview */}
        <div className="hidden md:block rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] overflow-hidden aspect-square">
          {stream && <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" aria-label="Your camera" />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Screen 6 — DoneScreen
 * ────────────────────────────────────────────────────────── */

function DoneScreen({ candidateName, recruiter, company, slaDays, videoSaveFailed, retryAllowed, onRetry, canRetry }) {
  const days = Math.max(1, Number(slaDays) || 5)
  return (
    <PageShell>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[rgb(42_157_87_/_0.10)] grid place-items-center">
          <CheckCircle2 size={16} className="text-[color:var(--color-rc-green)]" aria-hidden="true" />
        </span>
        <SectionLabel>All done</SectionLabel>
      </div>
      <Display className="mt-4">Thank you, {candidateName || 'there'}.</Display>
      <EditorialText className="mt-4 max-w-[52ch]">
        Your interview has been submitted successfully. Thank you for your time and thoughtfulness — we know these things take real effort.
      </EditorialText>

      <div className="mt-8 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
        <SectionLabel>What happens next</SectionLabel>
        <div className="mt-3 grid gap-3 text-[14.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
          <p>
            {(recruiter || 'Your recruiter')}{company ? ` at ${company}` : ''} will review your interview within {days} business day{days === 1 ? '' : 's'}.
          </p>
          <p className="text-[color:var(--color-rc-muted)]">
            You&rsquo;ll get an email once they&rsquo;ve made a decision. Look for it from <span className="text-[color:var(--color-rc-ink)] font-medium">interviews@recrewtai.com</span>.
          </p>
        </div>
      </div>

      {videoSaveFailed && (
        <div className="mt-6 rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-4 md:p-5">
          <SectionLabel>Recording not saved</SectionLabel>
          <p className="mt-2 text-[13.5px] text-[color:var(--color-rc-ink)] leading-relaxed">
            Your written responses were saved, but the video recording failed to upload. The recruiter will still receive your transcript. No action is needed from you.
          </p>
        </div>
      )}

      {retryAllowed && canRetry && (
        <div className="mt-8">
          <SecondaryButton onClick={onRetry} iconLeft={<RefreshCcw size={14} />}>Retake interview</SecondaryButton>
          <p className="mt-2 text-[12px] text-[color:var(--color-rc-muted)]">
            You can retake this interview once within 2 hours if you hit a technical issue.
          </p>
        </div>
      )}
    </PageShell>
  )
}


/* ─────────────────────────────────────────────────────────────
 * TransitionScreen — brief pause between questions (no interstitial copy)
 * ────────────────────────────────────────────────────────── */

function TransitionScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6" aria-hidden="true">
      <div className="h-1 w-24 rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
        <div className="h-full bg-[color:var(--color-rc-ink)] motion-safe:animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  )
}

function SavingScreen({ status }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
      <Spinner size={22} color="var(--color-rc-ink)" label="Saving your interview" />
      <p
        className="mt-6 text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        Saving your interview…
      </p>
      <p className="mt-2 text-[14px] text-[color:var(--color-rc-muted)] max-w-[380px] leading-relaxed">
        {status || 'Please do not close this page.'}
      </p>
    </div>
  )
}

function BrowserUnsupportedScreen({ browserName }) {
  return (
    <PageShell>
      <SectionLabel>Browser not supported</SectionLabel>
      <Display className="mt-4 max-w-[24ch]">This interview needs a modern browser.</Display>
      <EditorialText className="mt-4 max-w-[52ch]">
        {browserName ? `${browserName} doesn't fully support the features we need. ` : ''}
        Open this link in <strong className="text-[color:var(--color-rc-ink)] font-medium">Chrome</strong>,{' '}
        <strong className="text-[color:var(--color-rc-ink)] font-medium">Safari</strong>,{' '}
        <strong className="text-[color:var(--color-rc-ink)] font-medium">Firefox</strong>, or{' '}
        <strong className="text-[color:var(--color-rc-ink)] font-medium">Edge</strong> on a laptop or a recent phone.
      </EditorialText>
    </PageShell>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Main — InterviewPage
 * ────────────────────────────────────────────────────────── */

export default function InterviewPage() {
  const params = useParams()
  const stageId = params.stageId

  const [step, setStep] = useState('landing')     // landing | device | howto | warmup | live | transition | saving | done
  const [prevStep, setPrevStep] = useState(null)  // for retry

  const [stage, setStage]         = useState(null)
  const [role, setRole]           = useState(null)
  const [recruiter, setRecruiter] = useState(null)  // recruiter's display name
  const [questions, setQuestions] = useState([])
  const [candidateName, setCandidateName] = useState('')

  const [permissionState, setPermissionState] = useState('idle')    // idle | requesting | granted | denied
  const [tryingPermission, setTryingPermission] = useState(false)
  const [browserOk, setBrowserOk] = useState(true)
  const [browserName, setBrowserName] = useState('')
  const [onlineOk, setOnlineOk] = useState(true)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typingMode, setTypingMode] = useState(false)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [askedFollowUp, setAskedFollowUp] = useState(false)
  // Set to true after AI TTS finishes; the mic never opens until the
  // candidate clicks the visible "Ready to Answer" CTA. This guarantees
  // the interviewer's own voice is never captured by speech
  // recognition and never leaks into the answer transcript.
  const [awaitingStart, setAwaitingStart] = useState(false)
  // Countdown between "Ready to Answer" click and mic activation.
  // Values: 3 → 2 → 1 → 0 (mic open). Gives the candidate a beat
  // to settle so we don't record coughs, chair adjustments, or "ums".
  const [countdown, setCountdown] = useState(0)

  const [uploadStatus, setUploadStatus] = useState('')
  const [videoSaveFailed, setVideoSaveFailed] = useState(false)
  const [warmupTranscript, setWarmupTranscript] = useState('')

  // Refs
  const videoRef              = useRef(null)
  const previewRefs           = useRef({ device: null, warmup: null, live: null })
  const streamRef             = useRef(null)
  const mediaRecorderRef      = useRef(null)
  const audioRecorderRef      = useRef(null)
  const chunksRef             = useRef([])
  const audioChunksRef        = useRef([])
  const recognitionRef        = useRef(null)
  const transcriptRef         = useRef([])
  const sessionRowRef         = useRef(null)
  const cachedVoiceRef        = useRef(null)
  // One id for this whole interview attempt, generated once when the component
  // mounts and written onto every transcript row. This is what makes separate
  // attempts distinguishable — see addTranscriptRow.
  const sessionIdRef          = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null,
  )
  // Holds the <audio> element playing VoxCPM speech, so it can be stopped
  // when a question is interrupted or the candidate hits "repeat".
  const ttsAudioRef           = useRef(null)
  const finishedAtRef         = useRef(null)
  const recordingStartRef     = useRef(null)

  /* ── Preview binding ─────────────────────── */
  useEffect(() => {
    // Wire the streamRef.current to whichever video preview is mounted.
    const target = videoRef.current
    if (target && streamRef.current && target.srcObject !== streamRef.current) {
      target.srcObject = streamRef.current
    }
  }, [step])

  /* ── Load data + init ────────────────────── */

  useEffect(() => {
    ;(async () => {
      const { data: stageData } = await supabase.from('stages').select().eq('id', stageId).single()
      if (stageData) setStage(stageData)

      let roleRow = null
      if (stageData?.role_id) {
        const { data } = await supabase.from('roles').select().eq('id', stageData.role_id).single()
        roleRow = data
        setRole(data)
      }

      const { data: qData } = await supabase
        .from('questions').select().eq('stage_id', stageId).eq('approved', true)
      if (qData) {
        // Prepend the standard introduction questions before the
        // recruiter's approved AI questions. Each question carries
        // its own capability flags (adaptive / scored / recorded),
        // so submitAnswer() gates behaviour on the flags — not on
        // the type string.
        setQuestions([...INTRO_QUESTIONS, ...qData.map(toAiQuestion)])
      }

      // Recruiter name (from role.user_id → settings.full_name)
      if (roleRow?.user_id) {
        const { data: settingsRow } = await supabase
          .from('settings').select('full_name, company_name').eq('user_id', roleRow.user_id).single()
        if (settingsRow?.full_name) setRecruiter(settingsRow.full_name.split(' ')[0])
        // Attach company_name into role for the welcome copy
        if (settingsRow?.company_name) setRole((r) => r ? { ...r, company_name: settingsRow.company_name } : r)
      }
    })()

    // Browser + online checks
    const supported =
      typeof window !== 'undefined' &&
      !!(navigator?.mediaDevices?.getUserMedia) &&
      !!(window.MediaRecorder) &&
      (typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined' || typeof window.speechSynthesis !== 'undefined')
    setBrowserOk(supported)
    setBrowserName(guessBrowserName())
    setOnlineOk(typeof navigator !== 'undefined' ? navigator.onLine !== false : true)

    // Voice init
    initVoices()

    // Resume from localStorage — recover step / candidateName only.  We don't
    // resume mid-question because permissions + streams need to be re-granted.
    const stored = readStoredSession(stageId)
    if (stored?.candidateName) setCandidateName(stored.candidateName)

    // Online / offline listeners
    function onOnline() { setOnlineOk(true) }
    function onOffline() { setOnlineOk(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
    // eslint-disable-next-line
  }, [stageId])

  useEffect(() => {
    // Persist step + name so a refresh mid-flow lands on the right screen.
    // We only persist non-live steps — live requires media that can't be resumed.
    if (step === 'live' || step === 'saving' || step === 'transition') return
    writeStoredSession(stageId, { step, candidateName })
  }, [step, candidateName, stageId])

  function guessBrowserName() {
    if (typeof navigator === 'undefined') return ''
    const ua = navigator.userAgent || ''
    if (/Edg\//.test(ua)) return 'Edge'
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome'
    if (/Firefox\//.test(ua)) return 'Firefox'
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'
    return ''
  }

  function initVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const pick = () => {
      const voices = window.speechSynthesis.getVoices()
      cachedVoiceRef.current =
        voices.find((v) => v.name === 'Samantha (Enhanced)') ||
        voices.find((v) => v.name === 'Karen (Enhanced)') ||
        voices.find((v) => v.name === 'Moira (Enhanced)') ||
        voices.find((v) => v.name === 'Samantha') ||
        voices.find((v) => v.name === 'Karen') ||
        voices.find((v) => v.name === 'Google UK English Female') ||
        voices.find((v) => v.name.includes('Female') && v.lang.startsWith('en')) ||
        voices.find((v) => v.lang === 'en-US') || null
      const warmup = new SpeechSynthesisUtterance(' ')
      warmup.volume = 0
      window.speechSynthesis.speak(warmup)
    }
    if (window.speechSynthesis.getVoices().length > 0) pick()
    else window.speechSynthesis.onvoiceschanged = pick
  }

  // Stop any in-flight speech if the candidate closes the tab or navigates
  // away mid-question, so audio can't outlive the interview screen.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      const audio = ttsAudioRef.current
      if (audio) {
        audio.pause()
        if (audio.dataset.objectUrl === 'true') URL.revokeObjectURL(audio.src)
        ttsAudioRef.current = null
      }
    }
  }, [])

  /* ── Speech output ──────────────────────────────────────────
     Primary path is VoxCPM2 via /api/tts: one consistent, natural voice
     for every candidate regardless of their device. The browser's
     speechSynthesis is kept as a fallback ONLY — if the TTS service is
     unreachable the interview continues in the OS voice rather than
     failing outright. */

  // Matches the previous utterance.rate exactly, so pacing is unchanged.
  const TTS_RATE = 0.95
  // Ceiling on waiting for the server to return audio.
  const TTS_FETCH_TIMEOUT_MS = 12000
  // Ceiling on deciding whether to ask a follow-up. The candidate is sitting on
  // a transition screen while this runs, so it has to be short.
  const FOLLOWUP_TIMEOUT_MS = 7000
  // Ceiling on waiting for that audio to become playable. Deliberately short:
  // a candidate staring at a silent screen is worse than the OS voice.
  const TTS_LOAD_TIMEOUT_MS = 6000

  function stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    const audio = ttsAudioRef.current
    if (audio) {
      audio.pause()
      if (audio.dataset.objectUrl === 'true') URL.revokeObjectURL(audio.src)
      ttsAudioRef.current = null
    }
  }

  function speakTextBrowser(text, onDone) {
    if (typeof window === 'undefined' || !window.speechSynthesis) { onDone && onDone(); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (cachedVoiceRef.current) utterance.voice = cachedVoiceRef.current
    utterance.rate = TTS_RATE
    utterance.pitch = 1.0
    utterance.volume = 1
    setIsSpeaking(true)
    let done = false
    const fire = () => {
      if (done) return; done = true; setIsSpeaking(false); onDone && onDone()
    }
    utterance.onend = fire
    utterance.onerror = fire
    setTimeout(fire, 30000)
    window.speechSynthesis.speak(utterance)
  }

  async function speakText(text, onDone) {
    stopSpeaking()

    let done = false
    const fire = () => {
      if (done) return; done = true; setIsSpeaking(false); onDone && onDone()
    }
    // Same safety net as before: never leave the interview stuck waiting on
    // an "ended" event that never arrives.
    const safety = setTimeout(fire, 30000)

    const fallback = (why) => {
      clearTimeout(safety)
      if (done) return
      // Log the reason. Without this, a silent degradation to the OS voice is
      // indistinguishable from the feature never having shipped — which is
      // exactly how the first version hid a stalled-audio bug.
      if (why) console.warn('[tts] falling back to browser speech:', why)
      speakTextBrowser(text, onDone)
    }

    setIsSpeaking(true)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        // A cold GPU can take a while, but the candidate is waiting. Past this
        // we are better off speaking in the OS voice than sitting in silence.
        signal: AbortSignal.timeout(TTS_FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`tts ${response.status}`)

      // The route returns a signed URL normally, or raw audio bytes if the
      // cache upload failed.
      let src
      let isObjectUrl = false
      if ((response.headers.get('Content-Type') || '').includes('application/json')) {
        const data = await response.json()
        if (!data?.url) throw new Error('tts: no url')
        src = data.url
      } else {
        src = URL.createObjectURL(await response.blob())
        isObjectUrl = true
      }

      const audio = new Audio()
      audio.dataset.objectUrl = isObjectUrl ? 'true' : 'false'
      audio.preload = 'auto'
      audio.playbackRate = TTS_RATE
      audio.src = src
      ttsAudioRef.current = audio

      // Wait for the audio to be genuinely playable BEFORE calling play().
      //
      // This is the bug that shipped first time round: on a slow or flaky
      // connection the media stalls, and audio.play() then returns a promise
      // that never resolves AND never rejects. The interview sat in silence
      // until the 30s safety timer moved it on. Waiting for 'canplay' with an
      // explicit timeout means a stalled download degrades to the browser
      // voice in a couple of seconds instead of hanging.
      await new Promise((resolve, reject) => {
        const giveUp = setTimeout(
          () => reject(new Error('audio load timeout')),
          TTS_LOAD_TIMEOUT_MS,
        )
        audio.addEventListener('canplay', () => { clearTimeout(giveUp); resolve() }, { once: true })
        audio.addEventListener('error', () => { clearTimeout(giveUp); reject(new Error('audio load error')) }, { once: true })
        audio.load()
      })

      audio.onended = () => { clearTimeout(safety); fire() }
      audio.onerror = () => fallback('playback error')

      // Rejects if the browser blocks autoplay; fall back to the OS voice.
      await audio.play()
    } catch (err) {
      fallback(err?.message || 'unknown')
    }
  }

  /* ── Permissions + stream lifecycle ──────── */

  async function requestStream() {
    if (streamRef.current) { setPermissionState('granted'); return }
    setTryingPermission(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      setPermissionState('granted')
    } catch (err) {
      console.error('getUserMedia failed:', err)
      setPermissionState('denied')
    } finally {
      setTryingPermission(false)
    }
  }

  function releaseStream() {
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()) } catch {}
    }
    streamRef.current = null
  }

  /* ── Speech recognition (voice → transcript) ─── */

  function startListening({ persistLive = false } = {}) {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) return
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    let full = ''
    rec.onresult = (event) => {
      // Staleness guard: rec.stop() above is asynchronous — the browser
      // can still flush one last final result from a superseded
      // recognizer after a new question's instance has already taken
      // over recognitionRef.current. Without this check, that late event
      // overwrites the freshly-reset transcript (see askQuestion's
      // setTranscript('')) with the *previous* question's answer text.
      if (recognitionRef.current !== rec) return
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) full += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      const combined = (full + interim).trim()
      if (persistLive) setTranscript(combined)
      else setWarmupTranscript(combined)
    }
    rec.onerror = () => {}
    rec.onend = () => {
      // Same staleness guard — an orphaned recognizer's onend must not
      // resurrect itself via auto-restart once it's been superseded.
      if (recognitionRef.current !== rec) return
      if (persistLive && listening) {
        // auto-restart while listening (browser cuts off after ~60s)
        try { rec.start() } catch {}
      } else {
        setListening(false)
      }
    }
    try { rec.start(); setListening(true) } catch {}
    recognitionRef.current = rec
  }

  function stopListening() {
    setListening(false)

    if (recognitionRef.current) {
      const rec = recognitionRef.current

      // This recognizer is being deliberately stopped.
      // Neutralize its callbacks before stop() so its stale onend
      // closure cannot restart it or write another transcript.
      rec.onresult = null
      rec.onend = null
      rec.onerror = null

      try {
        rec.stop()
      } catch {}
    }
  }


  /* ── Live interview: start recording + first question ─── */

  async function beginLiveInterview() {
    if (!streamRef.current) { await requestStream(); if (!streamRef.current) return }
    // Start recorders
    const stream = streamRef.current
    const videoMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : ''
    try {
      const videoRecorder = new MediaRecorder(stream, { mimeType: videoMime, videoBitsPerSecond: 500000, audioBitsPerSecond: 64000 })
      mediaRecorderRef.current = videoRecorder
      chunksRef.current = []
      videoRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      videoRecorder.start()

      const audioStream = new MediaStream(stream.getAudioTracks())
      const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const audioRecorder = new MediaRecorder(audioStream, { mimeType: audioMime, audioBitsPerSecond: 64000 })
      audioRecorderRef.current = audioRecorder
      audioChunksRef.current = []
      audioRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      audioRecorder.start()
      recordingStartRef.current = Date.now()
    } catch (err) {
      console.error('MediaRecorder start failed:', err)
    }

    // Session tracking row
    const { data: sessionRow } = await supabase.from('interviews').insert({
      stage_id: stageId, speaker: 'session_start', content: 'in_progress',
      candidate_name: candidateName, status: 'in_progress',
      session_id: sessionIdRef.current,
    }).select().single()
    if (sessionRow) sessionRowRef.current = sessionRow.id

    setStep('live')
    setCurrentIndex(0)
    setIsFollowUp(false)
    askQuestion(0, false)
  }

  function askQuestion(index, followUp) {
    if (index >= questions.length) { finishInterview(); return }
    const q = questions[index]
    const text = q.text
    setCurrentQuestion(text)
    setTranscript('')
    setTypedAnswer('')
    setTypingMode(false)
    setIsFollowUp(!!followUp)
    setAskedFollowUp(false)
    setAwaitingStart(false)
    setCountdown(0)
    addTranscriptRow('interviewer', text)
    speakText(text, () => {
      // Do NOT auto-start listening. Speech recognition and the
      // browser's microphone stay closed until the candidate
      // explicitly clicks "Ready to Answer" — otherwise the AI's TTS
      // gets echoed back into the transcript.
      setAwaitingStart(true)
    })
  }

  function repeatCurrentQuestion() {
    if (!currentQuestion) return
    stopListening()
    setTranscript('')
    setTypedAnswer('')
    setAwaitingStart(false)
    setCountdown(0)
    speakText(currentQuestion, () => { setAwaitingStart(true) })
  }

  /**
   * Candidate clicked "Ready to Answer" — we run a 3-2-1 countdown
   * and only then open the microphone.
   *
   * Why the countdown: without it, the transcript often starts with
   * "cough… um… okay…" as the candidate settles. Three beats keeps
   * the recording clean and mirrors a real interviewer's pause after
   * asking a question.
   */
  function handleStartSpeaking() {
    if (isSpeaking) return       // ignore stray clicks while AI is talking
    if (countdown > 0) return    // countdown already in flight
    if (listening) return        // mic already open
    setAwaitingStart(false)
    setCountdown(3)
  }

  // Drive the 3 → 2 → 1 → mic-open transition. Runs entirely off
  // the countdown state so it stays cancellable — anything that
  // resets countdown to 0 aborts the sequence cleanly.
  useEffect(() => {
    if (countdown <= 0) return
    if (countdown === 1) {
      const id = setTimeout(() => {
        setCountdown(0)
        startListening({ persistLive: true })
      }, 900)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setCountdown((n) => n - 1), 900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  async function submitAnswer() {
    stopListening()
    setCountdown(0)
    setAwaitingStart(false)
    const answer = (typingMode ? typedAnswer : transcript).trim()
    if (!answer) return

    const currentQ = questions[currentIndex]

    // Persist the answer only for questions that opt into transcript
    // recording. Practice questions never touch the transcript.
    if (currentQ?.recorded !== false) {
      addTranscriptRow('candidate', answer)
    }

    // Adaptive follow-up: gated on question.adaptive, not on type
    // equality. New question types automatically inherit correct
    // behaviour by declaring adaptive:true|false.
    //
    // The DECISION to follow up belongs to /api/follow-up, which sees the
    // actual answer. It used to be a word-count test here, which was backwards:
    // it prodded candidates who had nothing left to say, and never probed the
    // long confident answers where the real gaps are.
    const canFollowUp = !!currentQ?.adaptive && !askedFollowUp && !isFollowUp
    if (canFollowUp) {
      setAskedFollowUp(true)
      setStep('transition')

      const followUpText = await requestFollowUp(currentQ.text, answer)

      if (followUpText) {
        setStep('live')
        const followUp = makeFollowupQuestion(followUpText)
        setCurrentQuestion(followUp.text)
        setTranscript(''); setTypedAnswer(''); setTypingMode(false)
        setIsFollowUp(true)
        addTranscriptRow('interviewer', followUp.text)
        speakText(followUp.text, () => { setAwaitingStart(true) })
        return
      }
      // No follow-up warranted, or generation failed — fall through and advance.
      // Deliberately NOT falling back to a canned "tell me more": a generic
      // prod with no gap behind it is what this change exists to remove.
    }

    // Otherwise advance to next question
    const next = currentIndex + 1
    setStep('transition')
    setTimeout(() => {
      if (next >= questions.length) { finishInterview(); return }
      setCurrentIndex(next)
      setStep('live')
      askQuestion(next, false)
    }, 700)
  }

  /**
   * Ask the server whether this answer deserves a follow-up.
   * Returns the question text, or null to move on.
   *
   * Bounded by a timeout because this runs mid-interview with a candidate
   * watching a transition screen. If Claude is slow we advance rather than
   * leave them staring at nothing.
   */
  async function requestFollowUp(question, answer) {
    try {
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageName: stage?.name || 'Interview',
          level: stage?.level || 'standard',
          question,
          answer,
        }),
        signal: AbortSignal.timeout(FOLLOWUP_TIMEOUT_MS),
      })
      if (!res.ok) return null
      const data = await res.json()
      const text = typeof data?.followUp === 'string' ? data.followUp.trim() : ''
      return text || null
    } catch (err) {
      console.warn('[follow-up] skipped:', err?.message || err)
      return null
    }
  }

  async function addTranscriptRow(speaker, content) {
    transcriptRef.current = [...transcriptRef.current, { speaker, content }]
    try {
      await supabase.from('interviews').insert({
        stage_id: stageId,
        speaker,
        content,
        candidate_name: candidateName,
        // Stamp every row of this attempt with one id. Do NOT rely on `token`
        // for this — that column defaults to gen_random_uuid(), so it is unique
        // per ROW and identifies nothing. Without session_id the transcript
        // view cannot tell one attempt from another and ends up concatenating
        // every interview a candidate ever started.
        session_id: sessionIdRef.current,
      })
    } catch (err) { console.error('transcript insert failed:', err) }
  }

  /* ── Finish + upload pipeline ────────────── */

  async function finishInterview() {
    stopListening()
    finishedAtRef.current = Date.now()
    setStep('saving')

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') audioRecorderRef.current.stop()

    await new Promise((r) => setTimeout(r, 1200))

    releaseStream()

    // ── Video upload (resilient pipeline from previous pass) ──
    const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
    const videoFilename = stageId + '-' + Date.now() + '.webm'
    let videoUrl = null

    if (videoBlob.size < MIN_VIDEO_BYTES) {
      console.warn('Video blob is too small to be a real recording:', videoBlob.size, 'bytes')
      setVideoSaveFailed(true)
    } else {
      setUploadStatus('Saving your interview recording…')
      for (let attempt = 0; attempt < RETRY_BACKOFFS.length && !videoUrl; attempt++) {
        if (RETRY_BACKOFFS[attempt] > 0) {
          setUploadStatus(`Retrying upload (attempt ${attempt + 1} of 3)…`)
          await new Promise((r) => setTimeout(r, RETRY_BACKOFFS[attempt]))
        }
        try {
          const formData = new FormData()
          formData.append('file', videoBlob)
          formData.append('upload_preset', 'interview-videos')
          const resp = await fetch('https://api.cloudinary.com/v1_1/dbrhpzdqz/video/upload', { method: 'POST', body: formData })
          const result = await resp.json().catch(() => ({}))
          if (resp.ok && result.secure_url) { videoUrl = result.secure_url; break }
          console.warn('Cloudinary attempt', attempt + 1, 'failed:', resp.status, result)
        } catch (err) { console.error('Cloudinary exception:', err) }
      }

      if (!videoUrl) {
        setUploadStatus('Cloudinary unavailable — saving to backup storage…')
        try {
          const { error: putErr } = await supabase.storage.from('interview-videos').upload(videoFilename, videoBlob, { contentType: 'video/webm' })
          if (!putErr) {
            const { data: signed } = await supabase.storage.from('interview-videos').createSignedUrl(videoFilename, 60 * 60 * 24 * 30)
            if (signed?.signedUrl) videoUrl = signed.signedUrl
          } else { console.error('Supabase storage upload failed:', putErr) }
        } catch (err) { console.error('Supabase storage exception:', err) }
      }

      if (videoUrl) {
        const { error: insErr } = await supabase.from('interviews').insert({
          stage_id: stageId, speaker: 'video', content: videoFilename,
          candidate_name: candidateName, video_url: videoUrl,
          session_id: sessionIdRef.current,
        })
        if (insErr) { console.error('video row insert failed:', insErr); setVideoSaveFailed(true) }
      } else {
        setVideoSaveFailed(true)
      }
    }

    // ── Audio upload (unchanged pattern) ──
    const audioMime = audioRecorderRef.current?.mimeType || 'audio/webm'
    const audioExt = audioMime.includes('mp4') ? 'mp4' : 'webm'
    const audioContentType = audioMime.includes('mp4') ? 'audio/mp4' : 'audio/webm'
    const audioBlob = new Blob(audioChunksRef.current, { type: audioContentType })
    const audioFilename = stageId + '-audio-' + Date.now() + '.' + audioExt
    try {
      const { error: audioErr } = await supabase.storage.from('interview-videos').upload(audioFilename, audioBlob, { contentType: audioContentType })
      if (!audioErr) {
        const { data: audioUrlData } = await supabase.storage.from('interview-videos').createSignedUrl(audioFilename, 60 * 60 * 24 * 7)
        if (audioUrlData) {
          await supabase.from('interviews').insert({
            stage_id: stageId, speaker: 'audio', content: 'Audio recording',
            candidate_name: candidateName, video_url: audioUrlData.signedUrl,
            session_id: sessionIdRef.current,
          })
          fetch('/api/analyze-audio', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioUrl: audioUrlData.signedUrl, stageId, candidateName, sessionId: sessionIdRef.current }),
          })
        }
      }
    } catch (err) { console.error('audio upload failed:', err) }

    // ── Session complete + trial counter + auto-score ──
    try {
      if (sessionRowRef.current) {
        await supabase.from('interviews').update({
          status: 'completed', completed_at: new Date().toISOString(),
        }).eq('id', sessionRowRef.current)
      }
      // Usage is now attributed at INVITE time via the subscription
      // system (see /api/send-invite). The old on-completion bump
      // double-counted every candidate, so it was removed.
    } catch (err) { console.error('completion housekeeping:', err) }

    // ── Auto-score ──
    // Single non-blocking fire-and-forget. The server now:
    //   • checks its upsert error (no more silent 200 with no row)
    //   • idempotently returns the cached row for concurrent duplicate
    //     requests (see SCORE_TTL_MS in /api/score-interview)
    // So retries at this layer just doubled LLM spend and burned time
    // on the "saving" screen. We fire once with keepalive:true so the
    // request survives page unload, and let the transcript-page
    // safety net cover the case where this request never reaches the
    // server at all (e.g., candidate on flaky Wi-Fi at that moment).
    try {
      const transcriptRows = transcriptRef.current.map((l) => ({ speaker: l.speaker, content: l.content }))
      const body = JSON.stringify({
        transcript: transcriptRows,
        stageName: stage?.name || 'Interview',
        stageId: String(stageId),
        candidateName,
        questions: questions.map((q) => q.text),
      })
      // keepalive:true survives page unload; we do NOT await so the
      // candidate isn't blocked on the "saving" screen for 30-90s
      // while Claude Opus reasons through the transcript.
      fetch('/api/score-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch((err) => console.warn('score-interview kick failed:', err))
    } catch (err) {
      console.error('Auto-score orchestration failed:', err)
    }

    setStep('done')
    // On completion, clear the resume marker
    clearStoredSession(stageId)
  }

  /* ── Handlers ────────────────────────────── */

  async function handleBeginFromLanding() {
    if (!candidateName.trim()) return
    setStep('device')
  }
  function handleBackFromDevice() { setStep('landing') }
  function handleContinueFromDevice() { setStep('howto') }
  function handleBackFromHowto() { setStep('device') }
  function handleContinueFromHowto() {
    // Warm-up: never recorded or scored (practice question). Mic stays
    // closed until candidate clicks Ready to Answer, then a 3-2-1
    // countdown gives them a beat to settle before recording begins.
    setWarmupTranscript('')
    setAwaitingStart(false)
    setCountdown(0)
    setStep('warmup')
    setTimeout(() => {
      speakText(WARMUP_QUESTION, () => setAwaitingStart(true))
    }, 400)
  }
  function handleWarmupSkip()     { stopListening(); setAwaitingStart(false); setCountdown(0); setStep('howto'); setTimeout(() => setStep('live-precursor'), 0); beginLiveInterview() }
  function handleWarmupContinue() { stopListening(); setAwaitingStart(false); setCountdown(0); beginLiveInterview() }
  function handleWarmupRetry() {
    stopListening()
    setAwaitingStart(false)
    setCountdown(0)
    setWarmupTranscript('')
    setTimeout(() => speakText(WARMUP_QUESTION, () => setAwaitingStart(true)), 200)
  }

  function handleDoneAnswer() { submitAnswer() }
  function handleRepeat() { repeatCurrentQuestion() }
  function handleTypingToggle(setter) { setTypingMode(setter); if (typeof setter === 'function') {} }

  function handleRetakeInterview() {
    // Only allowed if role.interview_retry_allowed and within 2h of first completion.
    setStep('landing')
    setCurrentIndex(0); setIsFollowUp(false); setTypedAnswer(''); setTranscript('')
    setVideoSaveFailed(false); setUploadStatus('')
    transcriptRef.current = []
  }

  /* ── Derived ─────────────────────────────── */

  const remainingMinutes = useMemo(() => {
    const left = Math.max(0, (questions.length - currentIndex))
    return Math.max(1, Math.round((left * AVG_SECONDS_PER_QUESTION) / 60))
  }, [questions.length, currentIndex])

  const canRetry = useMemo(() => {
    if (!role?.interview_retry_allowed) return false
    if (!finishedAtRef.current) return true
    return (Date.now() - finishedAtRef.current) < RETRY_WINDOW_MS
  }, [role?.interview_retry_allowed])

  const retryAllowed = !!role?.interview_retry_allowed
  const slaDays = role?.interview_response_sla_days || 5
  const companyName = role?.company_name || null

  /* ── Render ──────────────────────────────── */

  if (!browserOk) return <BrowserUnsupportedScreen browserName={browserName} />

  if (step === 'landing') {
    return (
      <LandingScreen
        stage={stage}
        role={role}
        recruiter={recruiter}
        questionCount={questions.length}
        candidateName={candidateName}
        setCandidateName={setCandidateName}
        onBegin={handleBeginFromLanding}
        canBegin={!!candidateName.trim() && questions.length > 0}
      />
    )
  }
  if (step === 'device') {
    // Bind the mounted preview to the videoRef
    return (
      <DeviceCheckScreen
        requestStream={requestStream}
        stream={streamRef.current}
        permissionState={permissionState}
        videoRef={videoRef}
        browserOk={browserOk}
        browserName={browserName}
        onlineOk={onlineOk}
        onContinue={handleContinueFromDevice}
        onBack={handleBackFromDevice}
        tryingPermission={tryingPermission}
      />
    )
  }
  if (step === 'howto') {
    return (
      <HowToScreen
        recruiter={recruiter}
        questionCount={questions.length}
        onBack={handleBackFromHowto}
        onContinue={handleContinueFromHowto}
      />
    )
  }
  if (step === 'warmup') {
    return (
      <WarmupScreen
        stream={streamRef.current}
        videoRef={videoRef}
        onSkip={handleWarmupSkip}
        onContinue={handleWarmupContinue}
        onRetry={handleWarmupRetry}
        isSpeaking={isSpeaking}
        listening={listening}
        transcript={warmupTranscript}
        awaitingStart={awaitingStart}
        onStartSpeaking={handleStartSpeaking}
        countdown={countdown}
      />
    )
  }
  if (step === 'transition') return <TransitionScreen />
  if (step === 'saving') return <SavingScreen status={uploadStatus} />
  if (step === 'done') {
    return (
      <DoneScreen
        candidateName={candidateName}
        recruiter={recruiter}
        company={companyName}
        slaDays={slaDays}
        videoSaveFailed={videoSaveFailed}
        retryAllowed={retryAllowed}
        canRetry={canRetry}
        onRetry={handleRetakeInterview}
      />
    )
  }
  if (step === 'live') {
    const q = questions[currentIndex]
    return (
      <LiveScreen
        stream={streamRef.current}
        videoRef={videoRef}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        question={currentQuestion || (q ? q.text : '')}
        isSpeaking={isSpeaking}
        listening={listening}
        transcript={transcript}
        typedAnswer={typedAnswer}
        setTypedAnswer={setTypedAnswer}
        typingMode={typingMode}
        setTypingMode={setTypingMode}
        onRepeat={handleRepeat}
        onDone={handleDoneAnswer}
        remainingMinutes={remainingMinutes}
        recording={true}
        isFollowUp={isFollowUp}
        awaitingStart={awaitingStart}
        onStartSpeaking={handleStartSpeaking}
        countdown={countdown}
      />
    )
  }

  return null
}
