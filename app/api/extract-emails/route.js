import Anthropic from '@anthropic-ai/sdk'
import { documentToMessageContent, parseJsonReply } from '@/lib/documents'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Pull email addresses out of a document that is a LIST of people.
 *
 * A client sends over a shortlist as a PDF, or a job board exports one.
 * The browser can scrape addresses out of a .csv or .txt on its own, but
 * a PDF read as text is binary noise, so those come here.
 *
 * This is deliberately NOT the resume reader. It does not judge anybody
 * and does not look at requirements. It answers one question: which email
 * addresses are in this file. If the answer turns out to be "one", the
 * caller is told, because a single-address document is almost always one
 * person's CV handed to the wrong control, and reading it properly is a
 * better outcome than harvesting the address and throwing the rest away.
 *
 * The prompt below used to describe the document as "expected to be a list
 * of people" and told the model to skip the sender's own contact details.
 * On a one-person CV that describes the only address in the file, so it
 * dutifully returned nothing and the recruiter was told there were no
 * addresses in a document with an address at the top of it. Never let the
 * instructions assume a shape the input does not have to take.
 */
const MAX_EMAILS = 200

const PROMPT = `Find the email addresses of PEOPLE in this document.

It might be a candidate shortlist, a spreadsheet exported to PDF, or a single
person's CV. All three are fine. Do not decide the document is the wrong kind
and return nothing — if there is one address because there is one person, that
one address is the answer.

List them in the order they appear, copied EXACTLY as written. Never invent,
correct, complete or tidy an address: an invitation sent to a plausible
address reaches a stranger.

The only addresses to leave out are generic company mailboxes that belong to
no particular person, such as info@, careers@, hr@, support@ or sales@.
A named individual's address is always included, including when it is the
author of the document, and including when it sits in a header or footer.

Return ONLY a raw JSON object, no markdown:

{ "emails": ["<address>", ...] }`

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

export async function POST(request) {
  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let file
  try {
    const form = await request.formData()
    file = form.get('file')
  } catch {
    return Response.json({ error: 'Could not read the upload.' }, { status: 400 })
  }
  if (!file) {
    return Response.json({ error: 'No file provided.' }, { status: 400 })
  }

  try {
    const doc = await documentToMessageContent(file, PROMPT)
    if (!doc.ok) return Response.json({ error: doc.error }, { status: 400 })

    let found = []

    if (doc.text) {
      // Word and plain text come back already extracted, so a regex is
      // both cheaper and more faithful than asking a model to retype
      // addresses it might silently tidy up.
      found = doc.text.match(EMAIL_RE) || []
    } else {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: doc.content }],
      })
      const parsed = parseJsonReply(res.content?.[0]?.text)
      const listed = Array.isArray(parsed?.emails) ? parsed.emails : []
      // Re-match every address rather than trusting the reply verbatim.
      // A model asked to copy an address will occasionally hand back a
      // plausible correction of one, and an invite to a plausible address
      // reaches a stranger.
      found = listed
        .map((e) => String(e || '').match(EMAIL_RE)?.[0])
        .filter(Boolean)
    }

    const emails = [...new Set(found.map((e) => e.trim().toLowerCase()))].slice(0, MAX_EMAILS)

    return Response.json({
      emails,
      // One address in a whole document is a CV, not a list.
      looksLikeOneCv: emails.length === 1,
    })
  } catch (error) {
    console.error('extract-emails failed:', error)
    return Response.json({ error: 'Could not read that file. Please try again.' }, { status: 500 })
  }
}
