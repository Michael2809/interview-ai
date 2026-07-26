'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import { SkeletonLine } from '@/components/AppShell/Skeleton'
import { Button, Spinner } from '@/components/ui'
import {
  getWorkspaceEntitlements,
  formatPrice,
  isUnlimited,
  displayLimit,
  PLAN_KEYS,
  SUBSCRIPTION_STATES,
  SUBSCRIPTION_ERROR_CODES,
} from '@/lib/subscription'
import {
  CheckCircle2, AlertTriangle, ChevronDown, CreditCard, Copy, Download,
  Package, ShieldAlert, Clock, Zap,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
 * Shared editorial primitives — same vocabulary as Settings + Billing.
 * ────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
      {children}
    </div>
  )
}

function Section({ title, description, action, children, divider = true }) {
  return (
    <section className={divider ? 'pt-10 md:pt-12 border-t border-[color:var(--color-rc-line)]' : ''}>
      <div className="mb-6 md:mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2
            className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[54ch]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function KeyValueRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-[color:var(--color-rc-line)] last:border-b-0">
      <span className="text-[13px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </span>
      <span className="text-[14.5px] text-right text-[color:var(--color-rc-ink)]">
        {value ?? '—'}
      </span>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    trial:     { label: 'Trial',     dot: 'bg-[color:var(--color-rc-yellow)]', fg: 'text-[color:var(--color-rc-warm)]' },
    active:    { label: 'Active',    dot: 'bg-[color:var(--color-rc-green)]',  fg: 'text-[color:var(--color-rc-green)]' },
    past_due:  { label: 'Past due',  dot: 'bg-[color:var(--color-rc-warm)]',   fg: 'text-[color:var(--color-rc-warm)]' },
    cancelled: { label: 'Cancelled', dot: 'bg-[color:var(--color-rc-muted)]',  fg: 'text-[color:var(--color-rc-muted)]' },
    paused:    { label: 'Paused',    dot: 'bg-[color:var(--color-rc-muted)]',  fg: 'text-[color:var(--color-rc-muted)]' },
  }
  const spec = map[status] || map.active
  return (
    <span className={'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold ' + spec.fg}>
      <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + spec.dot} />
      {spec.label}
    </span>
  )
}

function UsageBar({ label, used, limit, hint }) {
  const isUnl = limit === null || limit === undefined
  const capped = isUnl ? 0 : Math.min(1, Math.max(0, used / Math.max(1, limit)))
  const pct = Math.round(capped * 100)
  const nearLimit = !isUnl && capped >= 0.85
  const atLimit = !isUnl && capped >= 1
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 md:gap-6 items-baseline py-3 border-b border-[color:var(--color-rc-line)] last:border-b-0">
      <div>
        <div className="text-[14px] font-medium text-[color:var(--color-rc-ink)]">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-[color:var(--color-rc-muted)]">{hint}</div>}
      </div>
      <div className="h-[4px] w-full rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
        {!isUnl && (
          <div
            className="h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.22,.61,.36,1)]"
            style={{
              width: `${pct}%`,
              backgroundColor: atLimit ? 'var(--color-rc-yellow)' : (nearLimit ? 'var(--color-rc-warm)' : 'rgba(17,17,17,0.72)'),
            }}
          />
        )}
      </div>
      <div className="text-[12.5px] text-[color:var(--color-rc-muted)] tabular-nums whitespace-nowrap">
        {isUnl ? (
          <><span className="text-[color:var(--color-rc-ink)] font-medium">{used}</span> · Unlimited</>
        ) : (
          <>
            <span className="text-[color:var(--color-rc-ink)] font-medium">{used}</span>
            <span> / {limit}</span>
          </>
        )}
      </div>
    </div>
  )
}

function ComingSoonTile({ icon, title, description, footnote }) {
  return (
    <div className="rounded-[16px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5 md:p-6">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="shrink-0 h-9 w-9 rounded-full bg-white border border-[color:var(--color-rc-line)] grid place-items-center text-[color:var(--color-rc-muted)]">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--color-rc-ink)]" style={{ fontFamily: 'var(--font-editorial), inherit' }}>
              {title}
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
              Coming Soon
            </span>
          </div>
          {description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[58ch]">
              {description}
            </p>
          )}
          {footnote && (
            <p className="mt-3 text-[12px] text-[color:var(--color-rc-muted)]">{footnote}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyRow({ icon, title, description }) {
  return (
    <div className="rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5 md:p-6">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="shrink-0 h-9 w-9 rounded-full bg-white border border-[color:var(--color-rc-line)] grid place-items-center text-[color:var(--color-rc-muted)]">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-[color:var(--color-rc-ink)]" style={{ fontFamily: 'var(--font-editorial), inherit' }}>
            {title}
          </div>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[54ch]">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Toast({ tone = 'success', message, onDismiss }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onDismiss(), 3000)
    return () => clearTimeout(t)
  }, [message, onDismiss])
  if (!message) return null
  const Icon = tone === 'error' ? AlertTriangle : CheckCircle2
  const color = tone === 'error' ? 'text-[color:var(--color-rc-red)]' : 'text-[color:var(--color-rc-green)]'
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="fixed bottom-6 right-6 z-50 max-w-[380px] rounded-[12px] bg-white border border-[color:var(--color-rc-line)] px-4 py-3 flex items-center gap-2.5 [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)]"
    >
      <Icon size={15} className={color + ' shrink-0'} aria-hidden="true" />
      <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">{message}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Plan comparison — read-only card row shown under Current Plan.
 * No checkout: the "Choose" buttons only register intent (Coming Soon).
 *
 * Original compact editorial layout — plan name + price + 3-col
 * metric strip + condensed feature list + full-width action button.
 * ────────────────────────────────────────────────────────── */

function PlanRow({ plan, isCurrent, disabled, onChoose }) {
  const priceLabel = formatPrice(plan.price_cents, plan.currency)
  const cadence = plan.billing_period === 'monthly'
    ? '/ month'
    : plan.billing_period === 'annual' ? '/ year' : ''
  // Seats label pluralises so a 1-seat plan doesn't read as "1 seats".
  const seatLabel = plan.seat_limit === 1 ? 'Seat' : 'Seats'

  return (
    <div className={
      'rounded-[16px] bg-white border p-5 md:p-6 flex flex-col ' +
      (isCurrent ? 'border-[color:var(--color-rc-ink)]' : 'border-[color:var(--color-rc-line)]')
    }>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)]" style={{ fontFamily: 'var(--font-editorial), inherit' }}>
            {plan.name}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-[28px] leading-none font-semibold tracking-[-0.028em] text-[color:var(--color-rc-ink)] tabular-nums" style={{ fontFamily: 'var(--font-editorial), inherit' }}>
              {priceLabel}
            </span>
            {cadence && <span className="text-[12.5px] text-[color:var(--color-rc-muted)]">{cadence}</span>}
          </div>
          {plan.tagline && (
            <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] max-w-[42ch]">{plan.tagline}</p>
          )}
        </div>
        {isCurrent && <StatusBadge status="active" />}
      </div>

      {/* 3-column metric strip.
          Overlap fix: dropped the "/ mo" suffix on the Candidates
          label (context is already the plan's monthly price row
          above), tightened tracking, and let labels wrap naturally
          so no column overflows into its neighbour at narrow widths. */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)] leading-snug break-words">
            Roles
          </div>
          <div className="mt-1 text-[15px] font-medium text-[color:var(--color-rc-ink)] tabular-nums">
            {displayLimit(plan.role_limit)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)] leading-snug break-words">
            Candidates
          </div>
          <div className="mt-1 text-[15px] font-medium text-[color:var(--color-rc-ink)] tabular-nums">
            {displayLimit(plan.candidate_limit)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)] leading-snug break-words">
            Recruiter {seatLabel}
          </div>
          <div className="mt-1 text-[15px] font-medium text-[color:var(--color-rc-ink)] tabular-nums">
            {displayLimit(plan.seat_limit)}
          </div>
        </div>
      </div>

      <ul className="mt-4 grid gap-1.5">
        {(plan.features || []).slice(0, 6).map((f) => (
          <li key={f} className="text-[13px] leading-relaxed text-[color:var(--color-rc-ink)] flex items-start gap-2">
            <CheckCircle2 size={12} className="mt-1 shrink-0 text-[color:var(--color-rc-green)]" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Button
          variant={isCurrent ? 'ghost' : 'secondary'}
          size="sm"
          fullWidth
          disabled={isCurrent || disabled}
          onClick={() => onChoose(plan)}
          title={disabled && !isCurrent ? 'Working on it…' : undefined}
        >
          {isCurrent
            ? 'Current plan'
            : plan.key === PLAN_KEYS.ENTERPRISE
              ? 'Contact sales'
              : `Choose ${plan.name}`}
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SubscriptionPage
 * ────────────────────────────────────────────────────────── */

function formatDate(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SubscriptionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState({ tone: 'success', message: '' })
  const dismissToast = useCallback(() => setToast((t) => ({ ...t, message: '' })), [])
  const flashMessage = useCallback((message) => setToast({ tone: 'success', message }), [])

  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [settings, setSettings] = useState(null)
  const [entitlements, setEntitlements] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data?.user) {
          router.push('/login?next=' + encodeURIComponent('/subscription'))
          return
        }
        if (cancelled) return
        setUserId(data.user.id)
        setUserEmail(data.user.email)

        // Claim a Dodo payment that arrived before this account existed
        // (paid via the public pricing page, then signed up) so it's
        // reflected below instead of showing Trial until a manual
        // refresh. Best-effort — a failure here shouldn't block the
        // rest of the page from loading.
        try {
          await fetch('/api/subscription/claim-pending', { method: 'POST' })
        } catch (e) {
          console.warn('claim-pending check failed (non-fatal)', e)
        }
        if (cancelled) return

        const [ent, settingsRes] = await Promise.all([
          getWorkspaceEntitlements(supabase, data.user.id),
          supabase.from('settings').select('company_name,full_name').eq('user_id', data.user.id).maybeSingle(),
        ])
        if (cancelled) return

        setEntitlements(ent)
        setSettings(settingsRes?.data || null)
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          if (e?.code === SUBSCRIPTION_ERROR_CODES.NETWORK_ERROR) {
            console.warn('Subscription page: network unavailable')
            setError('Network unavailable. Check your connection and refresh.')
          } else {
            console.error('Subscription page load error:', e)
            setError(e.message || 'Failed to load subscription')
          }
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary       = entitlements   // legacy alias used through JSX below
  const plans         = entitlements?.plans || []
  const currentPlanKey = entitlements?.subscription?.plan_key || PLAN_KEYS.TRIAL
  const status        = entitlements?.effectiveStatus || SUBSCRIPTION_STATES.TRIAL
  const renewalDate   = entitlements?.period?.end || null
  const packRemaining = entitlements?.candidates?.packCredits || 0

  function copyWorkspaceId() {
    try {
      navigator.clipboard.writeText(userId || '')
      flashMessage('Workspace ID copied to clipboard.')
    } catch {
      /* ignore */
    }
  }

  const [changingPlan, setChangingPlan] = useState(false)

  async function handleChoosePlan(plan) {
    if (plan.key === PLAN_KEYS.ENTERPRISE) {
      window.location.href = 'mailto:hello@recrewt.ai?subject=Recrewt%20Enterprise%20enquiry'
      return
    }
    if (changingPlan) return
    setChangingPlan(true)
    try {
      const res = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPlanKey: plan.key }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setToast({ tone: 'error', message: body?.error || 'Could not change plan. Try again shortly.' })
        return
      }
      if (body?.requiresCheckout && body?.checkoutUrl) {
        window.location.href = body.checkoutUrl
        return
      }

      flashMessage(`You're now on ${plan.name}.`)
      // Refresh entitlements so the Current Plan / Usage sections reflect
      // the change immediately rather than waiting for a manual reload.
      const ent = await getWorkspaceEntitlements(supabase, userId)
      setEntitlements(ent)
    } catch (e) {
      console.error('Plan change failed', e)
      setToast({ tone: 'error', message: 'Network error — try again in a moment.' })
    } finally {
      setChangingPlan(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-[820px] mx-auto pb-16">
        {/* Header */}
        <header className="mb-10 md:mb-14">
          <SectionLabel>Subscription</SectionLabel>
          <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-[color:var(--color-rc-ink)] max-w-[22ch]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                Manage your workspace.
              </h1>
              <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
                View your plan, monitor usage, and prepare for the launch of billing.
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div aria-hidden="true" className="rc-skeleton space-y-6">
            {/* Current plan card */}
            <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
              <SkeletonLine className="w-28" height="h-2.5" />
              <div className="mt-3">
                <SkeletonLine className="w-1/3 max-w-[240px]" height="h-6" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between"><SkeletonLine className="w-24" height="h-3" /><SkeletonLine className="w-16" height="h-3" /></div>
                <div className="flex items-center justify-between"><SkeletonLine className="w-32" height="h-3" /><SkeletonLine className="w-20" height="h-3" /></div>
                <div className="flex items-center justify-between"><SkeletonLine className="w-28" height="h-3" /><SkeletonLine className="w-14" height="h-3" /></div>
              </div>
            </div>
            {/* Usage card */}
            <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
              <SkeletonLine className="w-20" height="h-2.5" />
              <div className="mt-3">
                <SkeletonLine className="w-1/4 max-w-[160px]" height="h-6" />
              </div>
              <div className="mt-5 h-2 w-full rounded-full bg-[color:var(--color-rc-soft)]" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] px-5 py-4 text-[13.5px] text-[color:var(--color-rc-ink)]">
            {error}
          </div>
        ) : (
          <>
            {/* Section 1 — Current Plan */}
            <Section title="Current plan" divider={false}>
              <div className="grid gap-0 mb-8">
                <KeyValueRow
                  label="Plan"
                  value={
                    <span className="inline-flex items-center gap-3">
                      <span className="text-[color:var(--color-rc-ink)] font-medium">
                        {summary.plan?.name || 'Trial'}
                      </span>
                      <StatusBadge status={status} />
                    </span>
                  }
                />
                <KeyValueRow
                  label="Price"
                  value={
                    summary.plan?.price_cents === null || summary.plan?.price_cents === undefined
                      ? (summary.plan?.key === PLAN_KEYS.ENTERPRISE ? 'Custom' : 'Free (Trial)')
                      : `${formatPrice(summary.plan.price_cents, summary.plan.currency)} / month`
                  }
                />
                <KeyValueRow label="Billing cycle" value={
                  summary.plan?.billing_period === 'monthly' ? 'Monthly' :
                  summary.plan?.billing_period === 'annual'  ? 'Annual'  :
                  summary.plan?.billing_period === 'custom'  ? 'Custom'  : 'Trial'
                } />
                <KeyValueRow label="Renewal date"     value={formatDate(renewalDate)} />
                <KeyValueRow label="Workspace owner" value={settings?.full_name || userEmail || '—'} />
              </div>

              <SectionLabel>Plans</SectionLabel>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {plans
                  .filter((p) => p.key !== PLAN_KEYS.TRIAL)
                  .map((p) => (
                    <PlanRow
                      key={p.key}
                      plan={p}
                      isCurrent={p.key === currentPlanKey}
                      disabled={changingPlan}
                      onChoose={handleChoosePlan}
                    />
                  ))}
              </div>
              <p className="mt-3 text-[12.5px] text-[color:var(--color-rc-muted)]">
                Plan changes bill immediately with prorated charges or credits. Enterprise moves go through sales.
              </p>
            </Section>

            {/* Section 2 — Usage */}
            <Section
              title="Usage"
              description="This cycle. Progress bars use warm tones only when limits are approaching."
            >
              <div className="grid">
                <UsageBar
                  label="Candidate interviews"
                  used={summary.candidates.used}
                  limit={summary.candidates.totalIncluded}
                  hint={
                    isUnlimited(summary.plan?.candidate_limit)
                      ? 'No cap on your plan'
                      : (packRemaining > 0
                          ? `${summary.plan.candidate_limit} plan + ${packRemaining} in active packs`
                          : `Included in the ${summary.plan?.name || 'current'} plan`)
                  }
                />
                <UsageBar
                  label="Active roles"
                  used={summary.roles.used}
                  limit={summary.roles.limit}
                  hint="Roles currently open on your workspace"
                />
                <UsageBar
                  label="Team members"
                  used={summary.seats.used}
                  limit={summary.seats.limit}
                  hint="Recruiters who can sign in"
                />
                <UsageBar
                  label="Remaining candidates"
                  used={summary.candidates.totalIncluded === null ? 0 : Math.max(0, summary.candidates.totalIncluded - summary.candidates.used)}
                  limit={summary.candidates.totalIncluded}
                  hint="Rolls to zero at each renewal"
                />
              </div>
            </Section>

            {/* Section 3 — Candidate Packs (architecture ready, purchase disabled) */}
            <Section
              title="Candidate packs"
              description="One-time boosts when you need to interview more candidates in a single cycle."
            >
              <ComingSoonTile
                icon={<Package size={16} aria-hidden="true" />}
                title="Temporary candidate packs"
                description="Add extra candidates without upgrading your plan. Packs are one-time, never recurring, and expire at your next renewal. Available after payment integration goes live."
                footnote={
                  entitlements?.permissions?.canPurchaseCandidatePack?.reason === 'renewal_window'
                    ? 'Packs are also unavailable within 7 days of your renewal date.'
                    : entitlements?.permissions?.canPurchaseCandidatePack?.reason === 'requires_paid_plan'
                    ? 'Packs are only available on a paid plan.'
                    : null
                }
              />
            </Section>

            {/* Section 4 — Payment Integration */}
            <Section
              title="Payment integration"
              description="How your workspace will be billed once payments go live."
            >
              <ComingSoonTile
                icon={<CreditCard size={16} aria-hidden="true" />}
                title="Payment integration"
                description="Payment processing and subscription management will be enabled after Dodo Payments integration. When it's live, you'll manage payment methods, invoices, and plan changes from this page."
              />
            </Section>

            {/* Section 5 — Billing history */}
            <Section
              title="Billing history"
              description="Every invoice from your Recrewt subscription."
            >
              <EmptyRow
                icon={<Download size={16} aria-hidden="true" />}
                title="No invoices available."
                description="Invoices will appear here after your first paid cycle."
              />
            </Section>

            {/* Section 6 — Upgrade */}
            <Section
              title="Upgrade plan"
              description="Plan changes happen from the Plans grid above — this section just points you back there."
            >
              <EmptyRow
                icon={<Zap size={16} aria-hidden="true" />}
                title="Use the Plans section above to switch tiers."
                description="Choosing Growth or Scale there bills immediately (prorated) and updates your entitlements right away. Enterprise moves go through sales."
              />
            </Section>

            {/* Section 7 — Workspace */}
            <Section
              title="Workspace"
              description="Identifying details about this workspace."
            >
              <div className="grid gap-0">
                <KeyValueRow label="Workspace name"  value={settings?.company_name || '—'} />
                <KeyValueRow label="Plan"            value={summary.plan?.name || 'Trial'} />
                <KeyValueRow label="Workspace owner" value={settings?.full_name || userEmail || '—'} />
                <div className="flex items-baseline justify-between gap-4 py-3 border-b border-[color:var(--color-rc-line)] last:border-b-0">
                  <span className="text-[13px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">Workspace ID</span>
                  <button
                    type="button"
                    onClick={copyWorkspaceId}
                    aria-label="Copy workspace ID"
                    className="inline-flex items-center gap-2 text-[13px] font-mono text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded px-2 py-1 -my-1 -mr-2 hover:bg-[color:var(--color-rc-soft)]"
                  >
                    <span className="truncate max-w-[26ch]">{userId || '—'}</span>
                    <Copy size={12} aria-hidden="true" className="text-[color:var(--color-rc-muted)]" />
                  </button>
                </div>
              </div>
            </Section>

            {/* Section 8 — Support (soft footer) */}
            <div className="pt-10 md:pt-12 border-t border-[color:var(--color-rc-line)]">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <SectionLabel>Need help?</SectionLabel>
                  <p className="mt-2 text-[13.5px] text-[color:var(--color-rc-muted)] max-w-[52ch]">
                    Questions about your subscription, an early billing preview, or Enterprise details? Reach out and we&rsquo;ll get back within one business day.
                  </p>
                </div>
                <Button as="a" href="mailto:hello@recrewt.ai?subject=Subscription%20help" variant="secondary" size="sm">
                  Email support
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Toast tone={toast.tone} message={toast.message} onDismiss={dismissToast} />
    </AppShell>
  )
}
