/**
 * Pre-warm the interview speech cache.
 *
 * Why this exists
 * ---------------
 * /api/tts caches generated audio by a hash of the question text, so a given
 * question is synthesized once ever. The problem is *who* pays for that first
 * synthesis: without pre-warming it is the first candidate to reach the
 * question, who waits while a GPU container cold-starts and loads a 2B model.
 * Measured on production: 73 seconds cold, 1.4 seconds cached.
 *
 * Warming moves that cost to a moment when nobody is waiting — the recruiter
 * approving a question, long before any candidate opens the interview.
 *
 * Two deliberate design choices
 * -----------------------------
 * 1. STRICTLY SEQUENTIAL. Every call in the app funnels through one shared
 *    promise chain. Firing these in parallel would make Modal scale up several
 *    GPU containers at once — each with its own cold start — turning a cheap
 *    background task into an expensive one. One warm container handling
 *    requests back-to-back is dramatically cheaper.
 *
 * 2. SILENT AND NON-BLOCKING. Nothing here is awaited by callers and every
 *    failure is swallowed. This is an optimisation, never a dependency: if it
 *    fails the interview still works, the audio is simply generated on demand
 *    later, and the client falls back to browser speech if even that fails.
 */

// One shared chain for the whole page, so concurrent callers queue rather
// than fan out. Approving seven questions in quick succession therefore
// results in seven sequential requests to one container, not seven containers.
let queue = Promise.resolve()

/**
 * Stop asking once the server has told us there is nothing to ask.
 *
 * /api/tts answers 503 when RECREWT_TTS_URL / RECREWT_TTS_TOKEN are unset —
 * every local dev machine, and production for as long as the Modal endpoint
 * is down. Without this, drafting a set of questions fires one doomed
 * request per question, every time, and buries the dev console. The flag is
 * per page load, so a fixed endpoint is picked up on the next refresh.
 */
let disabled = false

/**
 * @param {string[]} texts - question texts to synthesize ahead of time
 */
export function warmTtsCache(texts) {
  if (typeof window === 'undefined' || disabled) return
  const list = (Array.isArray(texts) ? texts : [texts])
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())

  for (const text of list) {
    queue = queue
      .then(async () => {
        if (disabled) return
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        // 503 means "not configured" — not a transient failure, so the rest
        // of this batch and every later one is pointless.
        if (res.status === 503) disabled = true
      })
      // Warm-up only — a failure here costs nothing and must never surface.
      .catch(() => {})
  }
}
