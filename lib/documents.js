import mammoth from 'mammoth'

export const SUPPORTED_DOC_HINT =
  'Please upload a PDF, Word doc (.docx), or text file (.txt).'

/**
 * Turn an uploaded document into something the Claude API can read.
 *
 * PDFs go across as a base64 `document` block rather than extracted text.
 * That is deliberate: the PDF text-extraction libraries mangled real-world
 * job descriptions and resumes (two-column layouts, tables, headers) badly
 * enough that the model was reasoning over scrambled text without any
 * signal that it had happened.
 *
 * Everything else is extracted to plain text here, because there is no
 * upside to shipping a .docx across the wire.
 *
 * @returns {{ ok: true, content: Array|string } | { ok: false, error: string }}
 */
export async function documentToMessageContent(file, prompt) {
  const fileName = (file?.name || '').toLowerCase()
  const mimeType = (file?.type || '').toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return {
      ok: true,
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
        },
        { type: 'text', text: prompt },
      ],
    }
  }

  let text = ''
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc')
  ) {
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else if (mimeType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    text = buffer.toString('utf-8')
  } else {
    return { ok: false, error: 'Unsupported file type. ' + SUPPORTED_DOC_HINT }
  }

  if (!text || !text.trim()) {
    return { ok: false, error: 'Could not read the document. Make sure it has readable text.' }
  }

  return { ok: true, content: prompt + '\n\n---\n' + text.trim() + '\n---', text: text.trim() }
}

/**
 * Parse a JSON object out of a model reply, tolerating the code fences and
 * stray prose models occasionally add despite being told not to.
 */
export function parseJsonReply(raw) {
  if (!raw) return null
  let text = String(raw).trim().replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(text)
  } catch {
    // Fall back to the outermost {...} in the reply.
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
