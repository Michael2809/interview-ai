import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import {
  reminderDecision, reminderTone, daysLeft, dedupeInvites, MAX_PER_RUN,
} from '@/lib/reminders'

/**
 * Nudge candidates who were invited and have not interviewed.
 *
 * This is the only thing in Recrewt that emails a person without a human
 * pressing a button, so it is built to under-send. Every decision about
 * whether a given candidate gets an email lives in lib/reminders.js and
 * is tested there; this file does the fetching, the wording and the
 * bookkeeping, and nothing else.
 *
 * Called by a daily cron (see vercel.json). Protected by CRON_SECRET
 * rather than a session, because there is no user in the loop.
 *
 * Safe to run twice: the counter and the last-sent stamp are written per
 * invite, and reminderDecision refuses anything sent inside 24 hours.
 */

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'interviews@recrewtai.com'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://recrewtai.com'

function authorised(request) {
  const secret = process.env.CRON_SECRET
  // No secret configured means the route is inert rather than open.
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

function escape(s) {
  return String(s || '').replace(/[<>&]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]
  ))
}

function emailBody({ roleName, companyName, link, tone, left }) {
  const lastCall = tone === 'last-call'
  const deadline = left
    ? `<p style="font-size:15px;color:#444;line-height:1.6;">The role closes to new interviews in <strong>${left} day${left === 1 ? '' : 's'}</strong>.</p>`
    : ''
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <div style="background:#111;padding:24px 32px;">
        <h1 style="color:#fff;font-size:20px;margin:0;">Recrewt AI</h1>
      </div>
      <div style="padding:36px 32px;border:1px solid #e8ebed;border-top:none;">
        <p style="font-size:15px;color:#444;margin-top:0;">Hello,</p>
        <p style="font-size:15px;color:#444;line-height:1.6;">
          ${lastCall
            ? `This is a last reminder about your interview for the <strong>${escape(roleName)}</strong> role at <strong>${escape(companyName)}</strong>. We will not email you about it again.`
            : `You were invited to a short video interview for the <strong>${escape(roleName)}</strong> role at <strong>${escape(companyName)}</strong>, and it looks like you have not had a chance yet.`}
        </p>
        ${deadline}
        <div style="text-align:center;margin:30px 0;">
          <a href="${link}" style="background:#6C5CE7;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">
            ${lastCall ? 'Take the interview' : 'Start your interview'}
          </a>
        </div>
        <p style="font-size:13px;color:#888;line-height:1.6;">
          If the button does not work, paste this into your browser:<br/>
          <a href="${link}" style="color:#6C5CE7;">${link}</a>
        </p>
        <p style="font-size:13px;color:#888;line-height:1.6;">
          If you are no longer interested, you can ignore this email and we
          will stop sending them.
        </p>
        <hr style="border:none;border-top:1px solid #e8ebed;margin:28px 0;" />
        <p style="font-size:13px;color:#aaa;margin:0;">
          Sent via Recrewt AI on behalf of ${escape(companyName)}. Reply to this email to reach the hiring team.
        </p>
      </div>
    </div>
  `
}

/* Vercel Cron calls this with GET and adds `Authorization: Bearer
   $CRON_SECRET` itself. POST is the same handler so the run can also be
   kicked by hand with curl when debugging. */
export async function GET(request)  { return run(request) }
export async function POST(request) { return run(request) }

async function run(request) {
  if (!authorised(request)) {
    return Response.json({ error: 'Not authorised.' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()

  // Candidate invites that have not been marked completed. The partial
  // index on (invited_at) covers exactly this shape.
  const { data: invites, error } = await svc
    .from('interviews')
    .select('id, stage_id, candidate_email, token, invited_at, status, reminder_count, last_reminded_at')
    .eq('speaker', 'invite')
    .neq('status', 'completed')
    .order('invited_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('send-reminders: invite lookup failed:', error)
    return Response.json({ error: 'Could not read invites.' }, { status: 500 })
  }

  // One row per person per stage before anything is decided or sent.
  const pending = dedupeInvites(invites)

  const stageIds = [...new Set(pending.map((i) => i.stage_id).filter(Boolean))]
  if (stageIds.length === 0) {
    return Response.json({ scanned: 0, sent: 0, skipped: {} })
  }

  const { data: stages } = await svc
    .from('stages').select('id, name, role_id').in('id', stageIds)
  const roleIds = [...new Set((stages || []).map((s) => s.role_id).filter(Boolean))]
  const { data: roles } = await svc
    .from('roles').select('id, title, user_id, status, interview_response_sla_days').in('id', roleIds)
  const { data: settings } = await svc
    .from('settings').select('user_id, company_name, email')
    .in('user_id', [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))])

  const stageById = new Map((stages || []).map((s) => [String(s.id), s]))
  const roleById = new Map((roles || []).map((r) => [String(r.id), r]))
  const companyByUser = new Map((settings || []).map((s) => [s.user_id, s.company_name]))
  // Same reasoning as the invite: a reminder a candidate cannot answer
  // is a dead end, and this one is chasing them.
  const replyToByUser = new Map((settings || []).map((s) => [s.user_id, s.email]))

  const skipped = {}
  let sent = 0

  for (const invite of pending) {
    if (sent >= MAX_PER_RUN) { skipped['batch-full'] = (skipped['batch-full'] || 0) + 1; continue }

    const stage = stageById.get(String(invite.stage_id))
    const role = stage ? roleById.get(String(stage.role_id)) : null

    const decision = reminderDecision(invite, role, now)
    if (!decision.send) {
      skipped[decision.reason] = (skipped[decision.reason] || 0) + 1
      continue
    }

    const link = `${SITE}/interview/${invite.stage_id}?token=${invite.token}`
    const companyName = companyByUser.get(role?.user_id) || 'the hiring team'
    const roleName = role?.title || 'the role'

    try {
      const replyTo = replyToByUser.get(role?.user_id) || null
      const { error: mailErr } = await resend.emails.send({
        from: FROM,
        ...(replyTo ? { replyTo } : {}),
        to: invite.candidate_email,
        subject: reminderTone(invite) === 'last-call'
          ? `Last reminder: your interview for ${roleName}`
          : `Reminder: your interview for ${roleName}`,
        html: emailBody({
          roleName, companyName, link,
          tone: reminderTone(invite),
          left: daysLeft(invite, role, now),
        }),
      })
      if (mailErr) throw new Error(mailErr.message)
    } catch (err) {
      console.error('send-reminders: send failed for invite', invite.id, err)
      skipped['send-failed'] = (skipped['send-failed'] || 0) + 1
      continue
    }

    /* Counter written only after the email actually left. The other
       order would silently swallow a candidate's reminder whenever
       Resend had a bad minute. */
    const { error: bumpErr } = await svc
      .from('interviews')
      .update({
        reminder_count: (Number(invite.reminder_count) || 0) + 1,
        last_reminded_at: now.toISOString(),
      })
      .eq('id', invite.id)

    if (bumpErr) {
      // The email is gone and we could not record it. Log loudly: the
      // 24-hour gap rule is the only thing standing between this and a
      // repeat tomorrow.
      console.error('send-reminders: COUNTER NOT WRITTEN for invite', invite.id, bumpErr)
    }
    sent += 1
  }

  return Response.json({ scanned: (invites || []).length, candidates: pending.length, sent, skipped })
}
