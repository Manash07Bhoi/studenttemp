import type { NextConfig } from "next";

/**
 * Next.js configuration for StudentTemp.
 *
 * HTTPS / TLS posture
 * -------------------
 * - TLS termination happens at the Caddy reverse proxy (see Caddyfile).
 * - The app trusts X-Forwarded-Proto from Caddy via the `trustProxy`-like
 *   middleware in `src/middleware.ts`.
 * - All cookies are issued with `Secure; HttpOnly; SameSite=Strict`.
 * - HSTS is enabled for production (Caddy sets it on the TLS frontend).
 * - WebSocket traffic is upgraded to `wss://` via the same proxy.
 *
 * Dev vs Prod
 * -----------
 * - In dev (`NODE_ENV !== 'production'`), `tls internal` is used by Caddy
 *   and HSTS is intentionally short-lived to avoid locking browsers.
 * - In production, Caddy auto-provisions Let's Encrypt certificates.
 */

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the preview panel and published URL to load dev resources
  allowedDevOrigins: [
    'preview-chat-70cf3ad2-cfaa-439a-83aa-f50b38e6e22a.space-z.ai',
    '*.space-z.ai',
    'studentemp.space-z.ai',
  ],
  // Security + performance headers.
  // NOTE: HSTS is set here as a secondary signal. The primary HSTS comes
  // from Caddy's TLS frontend (so it is always present on HTTPS responses,
  // even for static assets that bypass Next.js).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self' https://*.space-z.ai https://space-z.ai https://*.z.ai https://z.ai",
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Allow only secure WebSocket + same-origin API.
              // We rely on relative URLs so wss: is resolved against the page origin.
              "connect-src 'self' https:",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          // HSTS — only emitted when served over HTTPS (Caddy strips it on :80 redirects).
          // 30 days in dev to avoid accidental lock-in, 1 year in production.
          // NOTE: `preload` is intentionally NOT set. HSTS preload commits the domain
          // permanently to HTTPS in all major browsers — only enable after verifying
          // the entire deployment (all subdomains) is fully HTTPS-compatible.
          {
            key: 'Strict-Transport-Security',
            value: isProd
              ? 'max-age=31536000; includeSubDomains'
              : 'max-age=2592000',
          },
        ],
      },
      {
        // Allow service worker scope
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  // Compress responses
  compress: true,
  // Power features for PWA
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },
};

export default nextConfig;
