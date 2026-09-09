import Anthropic from '@anthropic-ai/sdk'
import { documentToMessageContent, parseJsonReply } from '@/lib/documents'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normaliseMatches, countEvidence, rankCandidates, mapWithLimit, isTransient } from '@/lib/resumes'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_FILES = 25

/**
 * How many resumes are read at once.
 *
 * Firing all 25 simultaneously is what a Promise.all over the file list
 * does by default, and it is the wrong shape: 25 concurrent requests
 * carrying multi-page PDFs will hit the rate limit, and a rate-limited
 * file used to come back to the recruiter as "could not read this file",
 * which is a lie about their document. Four at a time is slower on paper
 * and finishes about as fast in practice, because nothing gets rejected
 * and retried.
 */
const CONCURRENCY = 4
const MAX_ATTEMPTS = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Read a batch of resumes: pull out who they are, and how they line up
 * against the requirements the recruiter confirmed for this role.
 *
 * Two rules shape everything here.
 *
 * 1. It RANKS, it never rejects. The response is a sorted list with the
 *    evidence behind every judgement. Nobody is filtered out, because a
 *    candidate dropped by a machine never appears in any metric and the
 *    recruiter never learns they lost them.
 *
 * 2. Nothing is emailed from this endpoint. Resume parsing gets the
 *    address wrong often enough — two-column layouts, scanned files, a
 *    referrer's address in the header — that sending straight from it
 *    would eventually blast interview invites to the wrong people from
 *    the customer's own domain. This returns a list for a human to check.
 *
 * 3. THREE states per requirement, not two. Most real resumes are lists
 *    of responsibilities, not outcomes: "Managed SEO initiatives to
 *    improve organic visibility". Scored as a plain pass/fail that is a
 *    miss, and it lands the candidate next to someone in an unrelated
 *    trade who never mentioned SEO at all. Those two are not the same
 *    person. One is unproven, the other is absent, and a recruiter wants
 *    to know which. So: shown (with a quote), claimed (asserted, nothing
 *    behind it), absent (never mentioned).
 */
function buildPrompt(criteria) {
  const criteriaBlock = criteria.length
    ? `The recruiter has confirmed this role requires:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each requirement, decide which of three states the resume is in, and
never give credit for something merely adjacent.`
    : `No requirements have been confirmed for this role, so do not attempt a
match assessment. Return an empty "matches" array.`

  return `You are helping a recruiter triage resumes for a role.

${criteriaBlock}

Return ONLY a raw JSON object, no markdown:

{
  "name": "<the candidate's full name as written, or null>",
  "email": "<their email address, or null>",
  "email_confidence": "<high | low>",
  "headline": "<one short line: their current or most recent role, or null>",
  "matches": [
    { "requirement": "<the requirement, copied exactly>", "status": "shown | claimed | absent", "evidence": "<quoted from the resume, only when shown>" }
  ]
}

The three states, which matter more than anything else here:

- "shown"   The resume describes something the person actually did that
            demonstrates this, and you can quote the line. "Grew the blog
            from 18,000 to 61,000 sessions by consolidating thin posts."
- "claimed" The resume asserts this as a skill, a responsibility or a
            keyword, but gives you nothing you could quote as evidence.
            "Managed SEO initiatives", "Expert in email marketing", or the
            word sitting in a skills list. Most resumes are mostly this.
            It is NOT a failure and NOT a lie — it is unproven.
- "absent"  The resume does not mention this area at all.

Rules:
- email_confidence is "low" ONLY when the address itself is genuinely in
  doubt: the document holds more than one EMAIL ADDRESS and you had to pick,
  the one you picked might belong to a referee or a previous employer, or the
  characters around it were garbled enough that you may have misread them.
  A LinkedIn profile, a personal website, a portfolio link, a phone number or
  a postal address are not competing email addresses and must not lower your
  confidence — nearly every resume has some of those, and flagging on them
  leaves good candidates sitting unticked in a list the recruiter is
  skim-reading.
- "shown" REQUIRES a quote. If you cannot quote it, it is "claimed" at best.
- Do not inflate. A responsibility is not an outcome, and a tool name in a
  list is not proof of anything. When you are torn between shown and
  claimed, it is claimed.
- Judge only what the requirements ask about. Never comment on, and never let
  your assessment be affected by, the candidate's name, gender, age, marital
  status, photograph, nationality, native language, or which institutions they
  attended.
- If the document is not a resume, return name and email as null and an empty
  matches array.`
}

export async function POST(request) {
  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let files = []
  let roleId = null
  try {
    const form = await request.formData()
    files = form.getAll('resumes').filter(Boolean)
    roleId = form.get('roleId')
  } catch {
    return Response.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  if (!files.length) {
    return Response.json({ error: 'Add at least one resume.' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return Response.json({
      error: `That is ${files.length} files. Upload up to ${MAX_FILES} at a time so you can check them before sending.`,
    }, { status: 400 })
  }

  // Criteria come from the role, and only if this recruiter owns it.
  let criteria = []
  if (roleId) {
    const svc = createServiceClient()
    const { data: role } = await svc
      .from('roles').select('id, user_id, must_haves').eq('id', roleId).maybeSingle()
    if (!role || role.user_id !== user.id) {
      return Response.json({ error: 'Not your role.' }, { status: 403 })
    }
    criteria = (Array.isArray(role.must_haves) ? role.must_haves : [])
      .map((m) => (typeof m === 'string' ? m : m?.label))
      .filter(Boolean)
  }

  const prompt = buildPrompt(criteria)

  const results = await mapWithLimit(files, CONCURRENCY, async (file) => {
    const base = { fileName: file?.name || 'resume' }
    try {
      const doc = await documentToMessageContent(file, prompt)
      if (!doc.ok) return { ...base, ok: false, error: doc.error }

      let res
      for (let attempt = 1; ; attempt++) {
        try {
          res = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            messages: [{ role: 'user', content: doc.content }],
          })
          break
        } catch (err) {
          if (!isTransient(err) || attempt >= MAX_ATTEMPTS) throw err
          // Backing off rather than hammering: the whole batch is queued
          // behind this, so retrying instantly just deepens the pile.
          await sleep(700 * attempt * attempt)
        }
      }

      const parsed = parseJsonReply(res.content?.[0]?.text)
      if (!parsed) return { ...base, ok: false, error: 'Could not read this file.' }

      const email = typeof parsed.email === 'string' ? parsed.email.trim() : ''
      // A shape check, not validation. The point is to flag a row for the
      // human, never to silently drop somebody because of a regex.
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

      const matches = normaliseMatches(parsed.matches)
      const { shown, claimed } = countEvidence(matches)

      return {
        ...base,
        ok: true,
        name: parsed.name ? String(parsed.name).trim().slice(0, 120) : null,
        email: email || null,
        headline: parsed.headline ? String(parsed.headline).trim().slice(0, 160) : null,
        needsCheck: !email || !looksLikeEmail || parsed.email_confidence === 'low',
        matches,
        shown,
        claimed,
        total: matches.length,
      }
    } catch (err) {
      console.error('parse-resumes failed for', base.fileName, err?.message ?? err)
      // Say which kind of failure it was. "Could not read this file" sends
      // the recruiter off to inspect a document that was never the problem.
      return {
        ...base,
        ok: false,
        error: isTransient(err)
          ? 'Too many at once. Upload this one again on its own.'
          : 'Could not read this file.',
      }
    }
  })

  const sorted = rankCandidates(results)

  return Response.json({
    candidates: sorted,
    criteria,
    needsCheck: sorted.filter((r) => r.ok && r.needsCheck).length,
    unreadable: sorted.filter((r) => !r.ok).length,
  })
}
