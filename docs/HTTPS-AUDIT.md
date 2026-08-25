# HTTPS / TLS Audit & Migration — StudentTemp

This document captures the complete HTTPS posture of the StudentTemp project:
what was changed, how HTTPS is enforced, how certificates are managed, what
security headers are configured, and what HTTP references remain (and why).

It is intended as the single source of truth for the security review.

---

## 1. HTTPS Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (HTTPS)                                               │
│     │                                                          │
│     ▼  TLS 1.2 / 1.3                                           │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │  Caddy reverse proxy  (Caddyfile)                          │ │
│ │  - Listens on :80  → 308 redirect to :443                  │ │
│ │  - Listens on :443 → TLS termination                        │ │
│ │  - tls internal  (dev) / Let's Encrypt (prod)              │ │
│ │  - Sends X-Forwarded-Proto={scheme}, X-Forwarded-For,      │ │
│ │    X-Real-IP, Host                                          │ │
│ │  - Routes /?XTransformPort=3003 → mail-service (Socket.IO) │ │
│ │  - Routes everything else → :3000 (Next.js)                 │ │
│ └────────────────────────────────────────────────────────────┘ │
│     │ loopback TCP                  │ loopback TCP             │
│     ▼                               ▼                          │
│  Next.js 16 (app)              mail-service (Socket.IO + SMTP)│
│  - src/middleware.ts reads      - cors origin whitelist         │
│    X-Forwarded-Proto ONLY      - wss:// upgrade via Caddy       │
│    from trusted loopback peer                                    │
│  - All cookies set with Secure (prod / trusted-proxy dev)      │
└────────────────────────────────────────────────────────────────┘
```

**Key principle:** TLS termination happens at Caddy, not in the application.
The app trusts `X-Forwarded-Proto` **only** when the immediate peer is a
trusted loopback proxy (see `src/middleware.ts`).

---

## 2. What Was Changed

### Reverse proxy / TLS termination
| File | Change |
|------|--------|
| `Caddyfile` | Rewrote: now listens on both `:80` and `:443`, issues `308 permanent` HTTP→HTTPS redirect, uses `tls internal` for dev (auto-renewing Caddy CA), forwards `X-Forwarded-Proto/For/Host/Real-IP` to upstreams. |

### Next.js configuration
| File | Change |
|------|--------|
| `next.config.ts` | CSP rewritten to remove plain `ws:`/`http:` from `connect-src` (now `connect-src 'self' https:`). HSTS is now production-aware (1y+preload in prod, 30d in dev). `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` added. |
| `src/middleware.ts` | **New.** Trusted-proxy middleware: rewrites `req.nextUrl.protocol` to `https:` when `X-Forwarded-Proto: https` arrives from a loopback peer; strips forged headers otherwise. |

### Cookies & session management
| File | Change |
|------|--------|
| `src/lib/auth-utils.ts` | `setAccountCookie`/`clearAccountCookie` now accept `req` and conditionally emit `Secure` (prod: always; dev: only when X-Forwarded-Proto=https from trusted proxy). |
| `src/lib/mail-utils.ts` | Same `shouldSetSecure()` helper applied to `SESSION_COOKIE`. |
| `src/app/api/auth/login/route.ts` | Pass `req` to `setAccountCookie`. |
| `src/app/api/auth/signup/route.ts` | Pass `req` to `setAccountCookie`. |
| `src/app/api/auth/logout/route.ts` | Pass `req` to `clearAccountCookie`. |
| `src/app/api/accounts/delete/route.ts` | Pass `req` to `clearAccountCookie`. |
| `src/components/ui/sidebar.tsx` | Client-side sidebar cookie now uses `SameSite=Strict` + `Secure` (when on HTTPS). |

### WebSocket / Socket.IO
| File | Change |
|------|--------|
| `mini-services/mail-service/index.ts` | Socket.IO CORS `origin: '*'` replaced with explicit allow-list (PUBLIC_BASE_URL + dev loopback origins). `credentials: true` added. |
| `src/hooks/use-socket.ts` | Transport forced to `websocket` only (no `polling` fallback that would emit plain HTTP), `secure: true` to force `wss://`. |
| `src/app/layout.tsx` | Removed `<link rel="dns-prefetch" href="http://localhost:3003">` (mixed-content violation). Replaced with same-origin `/` preconnect. |

### Bug fixes (surfaced by HTTPS test traffic)
| File | Change |
|------|--------|
| `src/app/api/auth/me/route.ts` | BigInt serialization bug — `storageQuotaBytes` / `storageUsedBytes` now coerced to `String` (BigInt is not `JSON.stringify`-able → was throwing 500). |
| `src/app/api/admin/stats/route.ts` | Same BigInt fix on `_sum.storageUsedBytes`. |

### Environment
| File | Change |
|------|--------|
| `.env` | Added `PUBLIC_BASE_URL` (used by mail-service for Socket.IO CORS allow-list), `TRUSTED_PROXY_HOSTS`, and explanatory comments. |

### Documentation
| File | Change |
|------|--------|
| `tests/fixtures/README.md` | Updated `http://localhost:81` → `https://localhost:81`. |
| `docs/HTTPS-AUDIT.md` | This file. |

---

## 3. How HTTPS Is Enforced

1. **Caddy 308 redirect** — every plain-HTTP request is redirected to HTTPS
   with a permanent redirect. Caddy owns this so we never risk a redirect
   loop in the app.
2. **HSTS header** — emitted on every HTTPS response:
   - Production: `max-age=31536000; includeSubDomains; preload`
   - Dev: `max-age=2592000` (30 days, no preload — so dev environments
     don't accidentally HSTS-preload a fake domain).
   - HSTS is **not** set on the `:80` redirect response (Caddy strips it).
3. **Middleware trust** — `src/middleware.ts` rewrites `req.nextUrl.protocol`
   to `https:` so any internal code that asks "is this request HTTPS?" gets
   the correct answer. Untrusted peers cannot forge this.
4. **CSP** — `connect-src 'self' https:` blocks any future accidental
   fetch to a `http://` endpoint at runtime. Mixed-content is blocked.
5. **Cookie `Secure` flag** — every auth/session cookie is `Secure` in
   production, and conditionally `Secure` in dev (only when the request
   actually arrived over TLS via Caddy).

---

## 4. TLS Certificate Management

### Development (`tls internal`)
- Caddy uses its internal Certificate Authority to mint a certificate for
  `localhost` (and any SANs needed).
- Certificates are stored in Caddy's data directory (`~/.local/share/caddy`
  on Linux), **never committed to git**.
- Renewal is automatic (default 12h retry on failure).
- To trust the Caddy CA in your browser: `caddy trust` (installs the root
  CA into the system trust store).

### Production (Let's Encrypt)
- Remove the `tls internal` block in `Caddyfile`. Caddy will auto-provision
  a Let's Encrypt certificate for the canonical domain (resolved from the
  `Host` header / `:443` site address).
- Auto-renewal: Caddy renews 1/3 of the cert lifetime before expiry.
- No private keys ever touch the repo. Caddy manages storage/renewal.
- For wildcard or ECDSA, configure `tls` block explicitly.

### Certificate paths
- **Dev**: Caddy data dir (managed). Do not commit.
- **Prod**: Caddy data dir (managed). Do not commit.
- **If behind a cloud LB**: terminate TLS at the LB and set
  `PUBLIC_BASE_URL=https://your-domain`. Caddy can be removed entirely.

---

## 5. Security Headers Configured

| Header | Value | Source |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (prod) / `max-age=2592000` (dev) | `next.config.ts` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://*.space-z.ai https://space-z.ai https://*.z.ai https://z.ai` | `next.config.ts` |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts` |
| `X-Frame-Options` | `SAMEORIGIN` | `next.config.ts` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `next.config.ts` |
| `X-XSS-Protection` | `1; mode=block` | `next.config.ts` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | `next.config.ts` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `next.config.ts` |
| `Cross-Origin-Resource-Policy` | `same-site` | `next.config.ts` |

---

## 6. Remaining `http://` References and Why They Are Safe

A repo-wide grep for `http://` and `ws://` finds the following — all
intentional and safe:

| Location | Reference | Why it's safe |
|---|---|---|
| `public/logo.svg` | `xmlns="http://www.w3.org/2000/svg"` | XML namespace identifier, NOT a network URL. The SVG spec mandates this exact string. Removing it would break the image. |
| `docs/SMTP-SETUP.md` | `swaks --server localhost:2525`, `telnet localhost 2525` | CLI examples for talking to the **internal** SMTP server on loopback. Internal loopback traffic does not need TLS — it never leaves the host. |
| `tests/fixtures/send-test-mail.ts` | `host: 'localhost', port: 2525` | Same — internal SMTP loopback, no TLS required. |
| `mini-services/mail-service/index.ts` | `console.log('Test with: swaks --server localhost:${SMTP_PORT}')` | Internal dev hint, not a network request. |
| `src/lib/mail-utils.ts` | `return '127.0.0.1'` | Fallback when no `X-Forwarded-For`/`X-Real-IP` is present — this is the IP-hash for rate-limiting, not a URL. |

### Mixed-content verification
The browser loads **zero** `http://` resources:
- All `<link>` tags use `https://` (Google Fonts) or relative `/`.
- All `fetch()`/XHR use relative paths (no absolute `http://` URLs).
- WebSocket upgrades to `wss://` automatically (same HTTPS origin + `secure: true`).
- Service worker uses only relative paths.
- `next/font` self-hosts Geist (no external request).

---

## 7. Cookie Security Summary

| Cookie | HttpOnly | Secure | SameSite | Purpose |
|---|---|---|---|---|
| `st_account` | ✅ | ✅ (prod / trusted-proxy dev) | Strict | Account session token |
| `st_session` | ✅ | ✅ (prod / trusted-proxy dev) | Strict | Anonymous inbox session |
| `sidebar:state` | ❌ (UI pref) | ✅ (when HTTPS) | Strict | Sidebar open/closed state |

All sensitive cookies are `HttpOnly; Secure; SameSite=Strict`.

---

## 8. WebSocket (Socket.IO) Security

- **Transport**: `websocket` only (no `polling` fallback that would
  downgrade to plain HTTP long-poll).
- **Scheme**: `wss://` enforced via `secure: true` + same-origin HTTPS page.
- **Path**: `/?XTransformPort=3003` — Caddy routes this to the mail-service.
- **CORS**: mail-service Socket.IO server only accepts connections from
  origins in the allow-list (`PUBLIC_BASE_URL` + dev loopback). The old
  `origin: '*'` has been removed.
- **Credentials**: `credentials: true` on the server side; client uses
  same-origin so cookies flow naturally.

---

## 9. Authentication Flow Security

- `POST /api/auth/signup` — issues `st_account` cookie with `Secure` flag.
- `POST /api/auth/login` — same.
- `POST /api/auth/logout` — clears cookie with the same flags.
- `GET /api/auth/me` — reads cookie via `next/headers` (server-only).
- `POST /api/accounts/delete` — clears cookie on grace-period entry.

All authentication traffic is HTTPS-only in production. The middleware
ensures the app sees the correct scheme so absolute URLs (e.g. for email
links) are generated with `https://`.

---

## 10. Development vs Production

| Aspect | Dev | Production |
|---|---|---|
| TLS cert | Caddy `tls internal` (self-signed CA) | Let's Encrypt (auto) |
| HSTS | 30 days, no preload | 1 year, includeSubDomains, preload |
| Cookie `Secure` | Only when X-Forwarded-Proto=https from trusted proxy | Always |
| `NODE_ENV` | `development` | `production` |
| `PUBLIC_BASE_URL` | `https://localhost:81` | `https://your-domain.com` |
| Local Next.js (no proxy) | `http://localhost:3000` works, cookies are NOT `Secure` so login still works | N/A |

---

## 11. Testing Performed

### Static
- `bun run lint` → 0 errors.
- Repo-wide grep for `http://` and `ws://` — only intentional references remain (see §6).

### Runtime (agent-browser)
- Open `https://localhost:81` → cert warning accepted → page loads over HTTPS.
- Verify no mixed-content warnings in console.
- Verify `set-cookie` headers carry `Secure; HttpOnly; SameSite=Strict`.
- Login flow → cookie set correctly.
- Inbox generate → WebSocket connects via `wss://`.
- New message → real-time push received.

---

## 12. Deployment Steps (Production Checklist)

1. Set `PUBLIC_BASE_URL=https://your-domain.com` in `.env`.
2. Set `NODE_ENV=production`.
3. In `Caddyfile`, replace `tls internal` with a real domain block:
   ```
   https://your-domain.com {
     reverse_proxy localhost:3000 { ... }
   }
   ```
   Caddy will auto-provision Let's Encrypt.
4. (Optional) `caddy trust` on the server to install the CA (only relevant for `tls internal`).
5. Verify `:80` → `:443` redirect works (curl -I http://your-domain.com).
6. Verify HSTS header is present on HTTPS responses.
7. Verify `set-cookie` has `Secure` on login.
8. Verify WebSocket upgrades to `wss://`.
9. Set up cert renewal monitoring (Caddy does this automatically; set up
   alerts on failure).

---

## 13. Remaining Risks / Notes

- **HSTS preload**: only enable `preload` when you are 100% sure you want
  the domain permanently committed to HTTPS. We do NOT auto-preload in
  dev. In prod, set this only after verifying the deployment is stable.
- **Self-signed dev cert**: browsers will warn on first visit. Use
  `caddy trust` to install the local CA and remove the warning.
- **Subdomain cookies**: `SameSite=Strict` means cross-site navigation
  won't send the cookie. This is the desired privacy posture but may
  affect deep-linking from email clients. Acceptable tradeoff for a
  temporary email service.
- **Internal SMTP**: stays on plain TCP (loopback). If the mail-service
  is ever moved to a separate host, add STARTTLS or mTLS.

---

*Generated as part of the end-to-end HTTPS migration. Update this file
whenever the TLS/Cookie/proxy posture changes.*
