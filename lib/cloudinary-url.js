/**
 * Turn a Cloudinary delivery URL back into the public_id its API wants.
 *
 *   https://res.cloudinary.com/<cloud>/video/upload/v1712/interview-videos/abc.webm
 *                                                        ^^^^^^^^^^^^^^^^^^^^^^^^
 *                                                        interview-videos/abc
 *
 * Returns null for anything that is not a Cloudinary upload URL, so a
 * hand-edited or externally hosted video_url can never make us send junk
 * to the destroy endpoint.
 */
export function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null

  let path
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }

  const parts = path.split('/').filter(Boolean)
  const uploadAt = parts.indexOf('upload')
  if (uploadAt === -1) return null

  let rest = parts.slice(uploadAt + 1)
  // Drop version (v1712...) and transformation (w_400,h_300) segments.
  while (rest.length && (/^v\d+$/.test(rest[0]) || rest[0].includes(','))) {
    rest = rest.slice(1)
  }
  if (!rest.length) return null

  const last = rest[rest.length - 1]
  const dot = last.lastIndexOf('.')
  rest[rest.length - 1] = dot > 0 ? last.slice(0, dot) : last

  const publicId = rest.join('/')
  return publicId || null
}
