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
 * @param {string[]} texts - question texts to synthesize ahead of time
 */
export function warmTtsCache(texts) {
  if (typeof window === 'undefined') return
  const list = (Array.isArray(texts) ? texts : [texts])
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())

  for (const text of list) {
    queue = queue
      .then(() =>
        fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }),
      )
      // Warm-up only — a failure here costs nothing and must never surface.
      .catch(() => {})
  }
}
