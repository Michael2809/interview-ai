import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const { stageId, candidateEmail, origin, recruiterName, companyName } = await request.json()

  // ── Quota check ──────────────────────────────────────────────────────────
  const { data: stageCheck } = await supabase
    .from('stages')
    .select('role_id')
    .eq('id', stageId)
    .single()

  const { data: roleCheck } = await supabase
    .from('roles')
    .select('user_id')
    .eq('id', stageCheck?.role_id)
    .single()

  const recruiterId = roleCheck?.user_id

  if (recruiterId) {
    const { data: settings } = await supabase
      .from('settings')
      .select('plan, trial_interviews_completed, interviews_used_this_cycle, billing_cycle_start')
      .eq('user_id', recruiterId)
      .single()

    const plan = settings?.plan || 'trial'
    const interviewLimits = { trial: 5, starter: 100, growth: 500, enterprise: Infinity }
    const limit = interviewLimits[plan] ?? 5

    let used = 0
    if (plan === 'trial') {
      used = settings?.trial_interviews_completed || 0
    } else {
      // Reset counter if billing cycle has passed 30 days
      const cycleStart = new Date(settings?.billing_cycle_start || Date.now())
      const daysSinceCycle = (Date.now() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCycle >= 30) {
        await supabase.from('settings').update({
          interviews_used_this_cycle: 0,
          billing_cycle_start: new Date().toISOString()
        }).eq('user_id', recruiterId)
        used = 0
      } else {
        used = settings?.interviews_used_this_cycle || 0
      }
    }

    if (limit !== Infinity && used >= limit) {
      return Response.json({
        error: `Interview limit reached. You've used ${used}/${limit} interviews on your ${plan} plan. Please upgrade to continue.`
      }, { status: 403 })
    }

    // Increment the counter
    if (plan === 'trial') {
      await supabase.from('settings')
        .update({ trial_interviews_completed: used + 1 })
        .eq('user_id', recruiterId)
    } else {
      await supabase.from('settings')
        .update({ interviews_used_this_cycle: used + 1 })
        .eq('user_id', recruiterId)
    }
  }
  // ── End quota check ───────────────────────────────────────────────────────

  const token = crypto.randomUUID()

  // Fetch stage and role name
  const { data: stageData } = await supabase
    .from('stages')
    .select('name, role_id')
    .eq('id', stageId)
    .single()

  const stageName = stageData?.name || 'Interview'

  let roleName = 'the position'
  if (stageData?.role_id) {
    const { data: roleData } = await supabase
      .from('roles')
      .select('title')
      .eq('id', stageData.role_id)
      .single()
    if (roleData?.title) roleName = roleData.title
  }

  const { error } = await supabase.from('interviews').insert({
    stage_id: stageId,
    candidate_email: candidateEmail,
    token: token,
    invited_at: new Date().toISOString(),
    speaker: 'invite',
    content: 'Candidate invited',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const link = origin + '/interview/' + stageId + '?token=' + token

  const senderName = recruiterName && companyName
    ? `${recruiterName} from ${companyName}`
    : recruiterName
    ? recruiterName
    : companyName
    ? companyName
    : 'our team'

  const displayCompany = companyName || 'Recrewt AI'
  const subjectLine = `Interview Invitation — ${roleName} at ${displayCompany} — Action Required`

  const { error: emailError } = await resend.emails.send({
    from: 'interviews@recrewtai.com',
    to: candidateEmail,
    subject: subjectLine,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">

        <div style="background: #111; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between;">
          <h1 style="color: #ffffff; font-size: 20px; margin: 0;">Recrewt AI</h1>
          ${displayCompany !== 'Recrewt AI' ? `<span style="color: #aaa; font-size: 13px;">on behalf of ${displayCompany}</span>` : ''}
        </div>

        <div style="padding: 40px 32px; border: 1px solid #e8ebed; border-top: none;">
          <p style="font-size: 15px; color: #444; margin-top: 0;">Dear Candidate,</p>

          <p style="font-size: 15px; color: #444; line-height: 1.6;">
            You have been invited by <strong>${senderName}</strong> to complete a video interview for the <strong>${roleName}</strong> position.
          </p>

          <p style="font-size: 15px; color: #444; line-height: 1.6;">
            This is a <strong>${stageName}</strong> interview powered by <strong>Recrewt AI</strong>. Please review the following guidelines carefully before beginning.
          </p>

          <div style="background: #f9f9f9; border-left: 4px solid #6C5CE7; padding: 20px 24px; margin: 24px 0; border-radius: 4px;">
            <p style="font-weight: bold; font-size: 14px; color: #111; margin-top: 0;">Interview Guidelines</p>
            <ol style="font-size: 14px; color: #444; line-height: 2; margin: 0; padding-left: 20px;">
              <li>Complete your interview within <strong>48 hours</strong> of receiving this email.</li>
              <li>Find a <strong>quiet, well-lit space</strong> free from distractions before starting.</li>
              <li>The interview must be completed <strong>in one sitting</strong> — it cannot be paused or resumed.</li>
              <li>Speak <strong>clearly and at a natural pace</strong> when answering each question.</li>
              <li>Ensure you have a <strong>stable internet connection</strong> before proceeding.</li>
              <li>When prompted, <strong>allow access to your camera and microphone</strong> to begin.</li>
            </ol>
          </div>

          <p style="font-size: 15px; color: #444; line-height: 1.6;">
            When you are ready, click the button below to begin your interview for the <strong>${roleName}</strong> position at <strong>${displayCompany}</strong>.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="background: #6C5CE7; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: bold; display: inline-block;">
              Begin Interview
            </a>
          </div>

          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            If the button above does not work, copy and paste the following link into your browser:<br/>
            <a href="${link}" style="color: #6C5CE7;">${link}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e8ebed; margin: 32px 0;" />

          <p style="font-size: 13px; color: #aaa; margin: 0;">
            This is an automated message sent via Recrewt AI on behalf of ${displayCompany}. Please do not reply to this email.
          </p>
        </div>

        <div style="background: #f4f4f4; padding: 16px 32px; text-align: center;">
          <p style="font-size: 12px; color: #aaa; margin: 0;">© ${new Date().getFullYear()} Recrewt AI · <a href="${origin}/privacy" style="color: #aaa;">Privacy Policy</a></p>
        </div>

      </div>
    `,
  })

  if (emailError) {
    return Response.json({ error: emailError.message }, { status: 500 })
  }

  return Response.json({ success: true })
}