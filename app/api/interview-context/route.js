import { createServiceClient } from '@/lib/supabase/service'

/**
 * Public context for the candidate interview screen.
 *
 * Candidates have no account, so their browser can read none of this:
 * `roles` and `settings` are authenticated-only, which is why the invite
 * screen used to greet people with "You've been invited to interview for
 * a role" at "the team".
 *
 * The fix is this route rather than an anon RLS policy. Opening `roles`
 * to anon would expose every customer's role rows — descriptions, owner
 * ids, everything — to anyone holding the public anon key. Here the
 * server reads with the service key and hands back only the four fields
 * the screen actually renders.
 *
 * No auth required by design; a stage id is the same secret as the
 * interview link itself. Nothing returned is more sensitive than what
 * the invite email already told the candidate.
 */
export async function GET(request) {
  const stageId = new URL(request.url).searchParams.get('stageId')
  if (!stageId) {
    return Response.json({ error: 'stageId is required.' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: stage } = await svc
    .from('stages').select('id, name, role_id').eq('id', stageId).maybeSingle()
  if (!stage) {
    return Response.json({ error: 'Interview not found.' }, { status: 404 })
  }

  const { data: role } = await svc
    .from('roles').select('id, title, user_id, status').eq('id', stage.role_id).maybeSingle()

  let companyName = null
  let recruiter = null
  if (role?.user_id) {
    const { data: settings } = await svc
      .from('settings').select('full_name, company_name').eq('user_id', role.user_id).maybeSingle()
    companyName = settings?.company_name || null
    recruiter = settings?.full_name ? settings.full_name.split(' ')[0] : null
  }

  // `source` rides along because it decides whether the interview page
  // fires a follow-up. `covers` deliberately does NOT: telling the
  // candidate which requirement a question is testing is handing them
  // the marking scheme.
  const { data: questions } = await svc
    .from('questions').select('id, text, source')
    .eq('stage_id', stageId).eq('approved', true)
    .order('id', { ascending: true })

  return Response.json({
    stage: { id: stage.id, name: stage.name },
    // Deliberately narrow: title only. The description, experience level
    // and owner id are the recruiter's business, not the candidate's.
    role: role ? { id: role.id, title: role.title } : null,
    companyName,
    recruiter,
    questions: questions || [],
  })
}
