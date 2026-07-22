'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Mail, KeyRound, ShieldAlert, ChevronDown, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { Button, Modal, Spinner, TextField } from '@/components/ui'

/* ─────────────────────────────────────────────────────────────
 * Shared editorial primitives (unchanged vocabulary; lighter card
 * treatment — spacing + type do the separating, not borders).
 * ────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
      {children}
    </div>
  )
}

/* Lightweight section — no border, no shadow.  A quiet top-rule
 * separates each block; the type does the rest of the work. */
function Section({ title, description, children, tone = 'default', divider = true }) {
  const titleColor =
    tone === 'danger' ? 'text-[color:var(--color-rc-red)]' : 'text-[color:var(--color-rc-ink)]'
  return (
    <section className={divider ? 'pt-10 md:pt-12 border-t border-[color:var(--color-rc-line)]' : ''}>
      <div className="mb-6 md:mb-7">
        <h2
          className={'text-[19px] leading-tight font-semibold tracking-[-0.02em] ' + titleColor}
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
      {children}
    </section>
  )
}

function FieldGrid({ children }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>
}

function ReadOnlyEmail({ email }) {
  return (
    <div>
      <label className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
        Email
      </label>
      <div className="w-full h-11 px-3.5 flex items-center gap-2 bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] rounded text-[14.5px] text-[color:var(--color-rc-muted)]">
        <Mail size={13} aria-hidden="true" />
        <span className="truncate">{email || '—'}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-[color:var(--color-rc-muted)]">
        Contact support to change your email.
      </p>
    </div>
  )
}

function Toggle({ id, checked, onChange, disabled }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={
        'relative h-6 w-11 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 ' +
        (checked ? 'bg-[color:var(--color-rc-ink)]' : 'bg-[color:var(--color-rc-line)]') +
        (disabled ? ' opacity-60 cursor-not-allowed' : '')
      }
    >
      <span
        aria-hidden="true"
        className={
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ' +
          (checked ? 'translate-x-5' : 'translate-x-0')
        }
      />
    </button>
  )
}

function ToggleRow({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-medium text-[color:var(--color-rc-ink)]">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
            {description}
          </p>
        )}
      </div>
      <div className="pt-0.5">
        <Toggle id={id} checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Change password — clean action with a modal for confirmation.
 * Behaviour is unchanged (Supabase resetPasswordForEmail); only
 * the presentation is nicer.
 * ────────────────────────────────────────────────────────── */

function ChangePasswordAction({ userEmail, onFlashError, onFlashMessage }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function send() {
    if (!userEmail) return
    setSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: (typeof window !== 'undefined' ? window.location.origin : '') + '/login',
    })
    setSending(false)
    if (error) { onFlashError('Could not send reset email: ' + error.message); return }
    setSent(true)
    onFlashMessage('Password reset email sent.')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setSent(false); setOpen(true) }}
        className="inline-flex items-center gap-2 text-[14px] font-medium text-[color:var(--color-rc-ink)] hover:decoration-[3px] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <KeyRound size={14} aria-hidden="true" />
        Change password
      </button>
      <Modal
        open={open}
        onClose={() => !sending && setOpen(false)}
        title={sent ? 'Check your inbox' : 'Change your password'}
        description={
          sent
            ? `We sent a reset link to ${userEmail}. Follow it to set a new password.`
            : `We'll email a reset link to ${userEmail}. Follow the link to choose a new password.`
        }
        size="sm"
        dismissible={!sending}
        footer={
          sent ? (
            <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
              <Button variant="primary" onClick={send} loading={sending}>
                Send reset link
              </Button>
            </>
          )
        }
      >
        <p className="text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
          {sent
            ? 'The link expires in one hour. If you don’t see the email in a few minutes, check spam.'
            : 'For security, we don’t change passwords directly from this page. You’ll click the link in the email to finish.'}
        </p>
      </Modal>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Danger zone — progressive disclosure (collapsed by default)
 * ────────────────────────────────────────────────────────── */

function DangerZone({ userEmail }) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const canConfirm = typed.trim().toLowerCase() === (userEmail || '').trim().toLowerCase()
  return (
    <div className="pt-10 md:pt-12 border-t border-[color:var(--color-rc-line)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-[13px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={'transition-transform ' + (open ? 'rotate-0' : '-rotate-90')}
        />
        {open ? 'Hide danger zone' : 'Show danger zone'}
      </button>

      {open && (
        <div className="mt-8">
          <h2
            className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-red)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            Delete account
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[54ch]">
            Permanently removes your account, roles, invites, interviews, and every candidate transcript. This cannot be undone.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-[12.5px] text-[color:var(--color-rc-muted)] max-w-[46ch]">
              We&rsquo;ll process the request within 48 hours. You can also email{' '}
              <a
                href="mailto:support@recrewtai.com"
                className="text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4"
              >
                support@recrewtai.com
              </a>{' '}
              directly.
            </div>
            <Button
              variant="danger"
              size="sm"
              iconLeft={<ShieldAlert size={14} />}
              onClick={() => { setTyped(''); setConfirmOpen(true) }}
            >
              Delete account
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this account?"
        description="Your roles, invites, interviews, scores, and notes will be permanently removed. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!canConfirm}
              as="a"
              href={`mailto:support@recrewtai.com?subject=Account%20deletion%20request&body=Please%20delete%20my%20Recrewt%20account:%20${encodeURIComponent(userEmail || '')}`}
            >
              Email support to delete
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[13.5px] text-[color:var(--color-rc-muted)]">
          To confirm, type your email below. This opens a pre-filled email to support.
        </p>
        <TextField
          label={`Type "${userEmail || 'your email'}" to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={userEmail || ''}
          autoFocus
        />
      </Modal>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Toast — small, bottom-right, auto-dismissing.  Replaces the
 * inline success banner.
 * ────────────────────────────────────────────────────────── */

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
 * SettingsPage
 * ────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ tone: 'success', message: '' })

  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  const [firstName, setFirstName] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [notifyOnCompletion, setNotifyOnCompletion] = useState(true)

  const baselineRef = useRef({
    firstName: '', fullName: '', companyName: '', companyWebsite: '', notifyOnCompletion: true,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (cancelled) return
      setUserEmail(user.email)
      setUserId(user.id)
      const first = user.user_metadata?.first_name || ''

      const { data } = await supabase
        .from('settings')
        .select()
        .eq('user_id', user.id)
        .single()

      const full   = data?.full_name        || ''
      const cname  = data?.company_name     || ''
      const cweb   = data?.company_website  || ''
      const notify = data?.notify_on_completion ?? true

      if (cancelled) return
      setFirstName(first)
      setFullName(full)
      setCompanyName(cname)
      setCompanyWebsite(cweb)
      setNotifyOnCompletion(notify)

      baselineRef.current = {
        firstName: first, fullName: full, companyName: cname, companyWebsite: cweb, notifyOnCompletion: notify,
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDirty = useMemo(() => {
    const b = baselineRef.current
    return (
      firstName !== b.firstName ||
      fullName !== b.fullName ||
      companyName !== b.companyName ||
      companyWebsite !== b.companyWebsite ||
      notifyOnCompletion !== b.notifyOnCompletion
    )
  }, [firstName, fullName, companyName, companyWebsite, notifyOnCompletion])

  const flashMessage = useCallback((message) => setToast({ tone: 'success', message }), [])
  const flashError   = useCallback((message) => setToast({ tone: 'error',   message }), [])
  const dismissToast = useCallback(() => setToast((t) => ({ ...t, message: '' })), [])

  const saveChanges = useCallback(async () => {
    if (!isDirty || saving) return
    setSaving(true)
    const trimmedFirst = firstName.trim()

    const { error: authErr } = await supabase.auth.updateUser({
      data: { first_name: trimmedFirst || null },
    })
    if (authErr) {
      setSaving(false)
      return flashError('Could not save name: ' + authErr.message)
    }

    const { error: err } = await supabase.from('settings').upsert({
      user_id: userId,
      full_name: fullName || null,
      company_name: companyName || null,
      company_website: companyWebsite || null,
      notify_on_completion: notifyOnCompletion,
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (err) return flashError('Could not save: ' + err.message)

    baselineRef.current = {
      firstName: trimmedFirst, fullName, companyName, companyWebsite, notifyOnCompletion,
    }
    flashMessage('Settings saved.')
  }, [isDirty, saving, firstName, fullName, companyName, companyWebsite, notifyOnCompletion, supabase, userId, flashMessage, flashError])

  // ⌘S save shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (isDirty) { e.preventDefault(); saveChanges() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, saveChanges])

  return (
    <AppShell>
      <div className="max-w-[780px] mx-auto pb-16">
        {/* Header — Save Changes lives here now */}
        <header className="mb-10 md:mb-14">
          <SectionLabel>Settings</SectionLabel>
          <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-[color:var(--color-rc-ink)] max-w-[22ch]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                Manage your account.
              </h1>
              <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
                Update your profile, workspace, and preferences.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isDirty && !loading && (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-rc-muted)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
                  Unsaved changes
                </span>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={saveChanges}
                loading={saving}
                disabled={!isDirty || loading}
                aria-label={isDirty ? 'Save changes' : 'No changes to save'}
              >
                Save changes
              </Button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] py-16 grid place-items-center">
            <Spinner size={18} />
          </div>
        ) : (
          <>
            <Section
              title="Profile"
              description="How Recrewt refers to you and how candidates see you on invitations."
              divider={false}
            >
              <div className="grid gap-5">
                <FieldGrid>
                  <TextField
                    label="First name"
                    placeholder="e.g. Michael"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    description="Used to greet you on the dashboard."
                  />
                  <TextField
                    label="Full name"
                    placeholder="e.g. Michael Rokkala"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    description="Shown to candidates on invites."
                  />
                </FieldGrid>
                <ReadOnlyEmail email={userEmail} />
              </div>
            </Section>

            <Section
              title="Workspace"
              description="This appears on interview invitations candidates receive."
            >
              <FieldGrid>
                <TextField
                  label="Workspace name"
                  placeholder="e.g. Recrewt AI"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <TextField
                  label="Website"
                  type="url"
                  placeholder="https://recrewtai.com"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                />
              </FieldGrid>
            </Section>

            <Section
              title="Notifications"
              description="Email alerts. You can always read the inbox from the bell in the top bar."
            >
              <ToggleRow
                id="notify-completion"
                label="Candidate completion emails"
                description="Get an email when a candidate finishes their interview."
                checked={notifyOnCompletion}
                onChange={setNotifyOnCompletion}
              />
            </Section>

            <Section
              title="Password"
              description="For security, password changes go through your email."
            >
              <ChangePasswordAction
                userEmail={userEmail}
                onFlashError={flashError}
                onFlashMessage={flashMessage}
              />
            </Section>

            <DangerZone userEmail={userEmail} />
          </>
        )}
      </div>

      <Toast tone={toast.tone} message={toast.message} onDismiss={dismissToast} />
    </AppShell>
  )
}
