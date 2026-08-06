import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Pages reachable without a session.
  //
  // NOTE: '/' must be matched EXACTLY, never with startsWith(). The previous
  // version had '/' in this list and tested with startsWith(), which meant
  // every possible pathname matched, isPublicPage was always true, and the
  // redirect below never ran — the auth gate was a no-op.
  //
  // Suffixing with '/' on the prefix test also stops a future route like
  // '/loginhelp' from being treated as public just because it starts
  // with '/login'.
  const publicPaths = [
    '/login',
    '/interview',      // candidates open these by emailed link, no account
    '/upgrade',
    '/privacy',
    '/terms',
    '/reset-password',
  ]
  const { pathname } = request.nextUrl
  const isPublicPage =
    pathname === '/' ||
    publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))

  if (!user && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  /*
   * Run the auth gate on page routes only.
   *
   * Everything excluded below either handles its own auth or must never be
   * redirected. This matters more than it looks: once the gate above actually
   * works, any path that reaches it without being public gets sent to /login.
   * If static files were still matched, /assets/*.avif would redirect and the
   * landing page hero would break for every logged-out visitor, and
   * /sitemap.xml and /robots.txt would redirect for Googlebot.
   *
   *   api           — API routes authenticate their own callers
   *   _next         — framework internals
   *   assets        — static files served from /public
   *   favicon.ico, robots.txt, sitemap.xml — browser and crawler essentials
   *   *.ext         — any remaining file request (images, fonts, css, js)
   */
  matcher: [
    '/((?!api|_next|assets|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}