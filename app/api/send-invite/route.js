import { Resend } from 'resend'
import { supabase } from '../../../lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const { stageId, candidateEmail, origin } = await request.json()

  const token = crypto.randomUUID()

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

  const { error: emailError } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: candidateEmail,
    subject: 'You have been invited to an interview',
    html: '<p>You have been invited to complete an interview.</p><p><a href="' + link + '">Click here to start</a></p>',
  })

  if (emailError) {
    return Response.json({ error: emailError.message }, { status: 500 })
  }

  return Response.json({ success: true })
}