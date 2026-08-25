import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware — HTTPS / trusted-proxy handling.
 *
 * Why this exists
 * ---------------
 * The app runs behind a Caddy reverse proxy that terminates TLS. By the
 * time a request reaches Next.js, the connection between the browser and
 * Caddy is HTTPS, but the connection between Caddy and Next.js is plain
 * HTTP. We must therefore:
 *
 * 1. Trust the `X-Forwarded-Proto` header sent by Caddy.
 * 2. Stamp the request's real scheme onto `req.nextUrl.protocol` so the
 *    rest of the app (cookie `Secure` flag, OAuth callbacks, absolute URLs)
 *    sees the request as HTTPS.
 * 3. Refuse to honor the forwarded header when the request did NOT come
 *    from a trusted proxy, so an attacker on the network cannot spoof
 *    `X-Forwarded-Proto: https` on a plain-HTTP request.
 *
 * Security notes
 * --------------
 * - The trusted-proxy set is intentionally small (loopback + Caddy).
 * - This middleware never sends a redirect itself; Caddy owns the 308
 *   HTTP→HTTPS redirect. Doing it here too would risk loops when Caddy
 *   already handled it.
 */

const TRUSTED_PROXY_HOSTNAMES = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
])

function isTrustedProxy(req: NextRequest): boolean {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) return false
  // The left-most entry in XFF is the original client.
  // The right-most entry is the immediate peer (Caddy).
  const parts = xff.split(',').map((p) => p.trim())
  const peer = parts[parts.length - 1]
  return TRUSTED_PROXY_HOSTNAMES.has(peer)
}

export function proxy(req: NextRequest) {
  // Note: Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
  // and requires the exported function to be named `proxy` (or be the default export).
  const proto = req.headers.get('x-forwarded-proto')
  const trusted = isTrustedProxy(req)

  // Build the response we'll hand back to Next.
  const res = NextResponse.next()

  // Re-write the internal URL scheme so Next.js APIs (cookies, OG, etc.)
  // produce https:// URLs even when Caddy proxies to us over plain TCP.
  if (trusted && proto === 'https') {
    const url = req.nextUrl.clone()
    url.protocol = 'https:'
    // Tell downstream handlers we're "really" HTTPS.
    res.headers.set('x-studenttemp-scheme', 'https')
    // Forward to handlers that read headers instead of URL.
    req.headers.set('x-forwarded-proto', 'https')
  } else if (!trusted) {
    // Strip forwarded headers from untrusted peers so they cannot lie.
    res.headers.delete('x-forwarded-proto')
    res.headers.delete('x-forwarded-for')
  }

  return res
}

export const config = {
  // Run on every route (API + page + static).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
}
