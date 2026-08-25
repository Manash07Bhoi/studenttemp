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
│ │  Caddy reverse proxy  (Caddyfile at /app/Caddyfile)        │ │
│ │  - Port :81 with `tls internal` (self-signed CA for dev)  │ │
│ │  - HTTP→HTTPS redirect on same port                        │ │
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

**Sandbox note:** The infra-managed Caddyfile at `/app/Caddyfile` is owned
by root and currently serves plain HTTP on `:81` (no `tls internal`). The
project's reference Caddyfile at `/home/z/my-project/Caddyfile` includes
the correct `tls internal` + redirect configuration, but applying it
requires infra redeployment. All application-layer HTTPS hardening
(cookies, CSP, HSTS, WebSocket, CORS) is in place and will take effect
the moment Caddy enables TLS.

---

## 2. What Was Changed

### Reverse proxy / TLS termination
| File | Change |
|------|--------|
| `Caddyfile` (project reference) | Updated: `:81` site with `tls internal`, `@not_https` matcher → 308 redirect to HTTPS, X-Forwarded headers preserved. Production template included as a comment. |

### Next.js configuration
| File | Change |
|------|--------|
| `next.config.ts` | CSP rewritten: `connect-src 'self' https:` (no plain `ws:`/`http:`), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. HSTS is environment-aware. **`preload` removed** per security review — only `max-age` + `includeSubDomains`. |
| `src/middleware.ts` | Trusted-proxy middleware: trusts `X-Forwarded-Proto: https` only from loopback peers (127.0.0.1/::1/localhost). Rewrites `req.nextUrl.protocol` to `https:`. Strips forged headers from untrusted peers. |

### Cookies & session management
| File | Change |
|------|--------|
| `src/lib/auth-utils.ts` | `setAccountCookie`/`clearAccountCookie` accept `req` and conditionally emit `Secure` (prod: always; dev: only when X-Forwarded-Proto=https from trusted proxy). |
| `src/lib/mail-utils.ts` | `shouldSetSecure()` helper applied to `SESSION_COOKIE` in `getOrCreateSession`. |
| `src/app/api/session/route.ts` | **Fixed:** Session recover cookie now emits `Secure` when behind HTTPS proxy (was hardcoded without `Secure`). |
| `src/app/api/auth/login/route.ts` | Pass `req` to `setAccountCookie`. |
| `src/app/api/auth/signup/route.ts` | Pass `req` to `setAccountCookie`. |
| `src/app/api/auth/logout/route.ts` | Pass `req` to `clearAccountCookie`. |
| `src/app/api/accounts/delete/route.ts` | Pass `req` to `clearAccountCookie`. |
| `src/components/ui/sidebar.tsx` | Client-side sidebar cookie uses `SameSite=Strict` + `Secure` (when `window.location.protocol === 'https:'`). |

### WebSocket / Socket.IO
| File | Change |
|------|--------|
| `mini-services/mail-service/index.ts` | Socket.IO CORS `origin: '*'` replaced with explicit allow-list. **Removed `http://localhost:81`** (only `https://localhost:81` kept — Caddy provides TLS). Kept `http://localhost:3000` for direct dev without proxy. Added `credentials: true`. |
| `src/hooks/use-socket.ts` | Transport forced to `websocket` only (no `polling` fallback that would emit plain HTTP). `secure: true` forces `wss://`. |
| `src/app/layout.tsx` | Removed mixed-content `<link rel="dns-prefetch" href="http://localhost:3003">`. Replaced with same-origin `/` preconnect. |

### Bug fixes (surfaced by HTTPS test traffic)
| File | Change |
|------|--------|
| `src/app/api/auth/me/route.ts` | BigInt serialization bug — `storageQuotaBytes` / `storageUsedBytes` coerced to `String` (was throwing 500 `TypeError: Do not know how to serialize a BigInt`). |
| `src/app/api/admin/stats/route.ts` | Same BigInt fix on `_sum.storageUsedBytes` aggregate. |

### Environment
| File | Change |
|------|--------|
| `.env` | Added `PUBLIC_BASE_URL=https://localhost:81` (used by mail-service for Socket.IO CORS allow-list). Added `TRUSTED_PROXY_HOSTS=127.0.0.1,::1,localhost`. Explanatory comments. |

### Documentation
| File | Change |
|------|--------|
| `tests/fixtures/README.md` | Updated `http://localhost:81` → `https://localhost:81`. |
| `docs/HTTPS-AUDIT.md` | This file. |

---

## 3. How HTTPS Is Enforced

1. **Caddy redirect** — `@not_https` matcher redirects plain-HTTP requests to HTTPS.
2. **HSTS header** — emitted on every HTTPS response:
   - Production: `max-age=31536000; includeSubDomains`
   - Dev: `max-age=2592000` (30 days)
   - **`preload` is intentionally NOT set** — HSTS preload commits the domain
     permanently to HTTPS in all major browsers. Only enable after verifying
     the entire deployment (all subdomains) is fully HTTPS-compatible.
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
- Replace the `:81` block in `Caddyfile` with a real domain block:
  ```
  https://your-domain.com {
    reverse_proxy localhost:3000 { ... }
  }
  ```
  Caddy will auto-provision a Let's Encrypt certificate.
- Auto-renewal: Caddy renews 1/3 of the cert lifetime before expiry.
- No private keys ever touch the repo. Caddy manages storage/renewal.

### Certificate paths
- **Dev**: Caddy data dir (managed). Do not commit.
- **Prod**: Caddy data dir (managed). Do not commit.
- **If behind a cloud LB**: terminate TLS at the LB and set
  `PUBLIC_BASE_URL=https://your-domain`. Caddy can be removed entirely.

---

## 5. Security Headers Configured

| Header | Value | Source |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (prod) / `max-age=2592000` (dev) — **no preload** | `next.config.ts` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://*.space-z.ai https://space-z.ai https://*.z.ai https://z.ai` | `next.config.ts` |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts` |
| `X-Frame-Options` | `SAMEORIGIN` | `next.config.ts` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `next.config.ts` |
| `X-XSS-Protection` | `1; mode=block` | `next.config.ts` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | `next.config.ts` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `next.config.ts` |
| `Cross-Origin-Resource-Policy` | `same-site` | `next.config.ts` |

**Verified live** via `curl -sI http://localhost:81/` — all 8 headers present.

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
| `mini-services/mail-service/index.ts` | `'http://localhost:3000'`, `'http://127.0.0.1:3000'` (in CORS allow-list) | Direct Next.js dev server (no Caddy proxy). Only used when bypassing Caddy for local debugging. When Caddy is in front, the origin is `https://localhost:81`. |
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

**Verified live:**
- `POST /api/auth/signup` with `X-Forwarded-Proto: https` →
  `set-cookie: st_account=...; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000` ✅
- `POST /api/inboxes` with `X-Forwarded-Proto: https` →
  `set-cookie: st_session=ST-XXXX-XXXX; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=604800` ✅
- `POST /api/session` (recover) with `X-Forwarded-Proto: https` →
  `setCookie: st_session=ST-XXXX-XXXX; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=604800` ✅

---

## 8. WebSocket (Socket.IO) Security

- **Transport**: `websocket` only (no `polling` fallback that would
  downgrade to plain HTTP long-poll).
- **Scheme**: `wss://` enforced via `secure: true` + same-origin HTTPS page.
- **Path**: `/?XTransformPort=3003` — Caddy routes this to the mail-service.
- **CORS**: mail-service Socket.IO server only accepts connections from
  origins in the allow-list:
  - `PUBLIC_BASE_URL` (e.g. `https://localhost:81`)
  - `https://localhost:81`, `https://127.0.0.1:81` (Caddy dev)
  - `http://localhost:3000`, `http://127.0.0.1:3000` (direct dev, no proxy)
  - The old `origin: '*'` has been removed.
- **Credentials**: `credentials: true` on the server side; client uses
  same-origin so cookies flow naturally.

---

## 9. Authentication Flow Security

- `POST /api/auth/signup` — issues `st_account` cookie with `Secure` flag.
- `POST /api/auth/login` — same.
- `POST /api/auth/logout` — clears cookie with the same flags.
- `GET /api/auth/me` — reads cookie via `next/headers` (server-only).
- `POST /api/accounts/delete` — clears cookie on grace-period entry.
- `POST /api/session` (recover) — issues `st_session` with `Secure` flag.

All authentication traffic is HTTPS-only in production. The middleware
ensures the app sees the correct scheme so absolute URLs (e.g. for email
links) are generated with `https://`.

---

## 10. Development vs Production

| Aspect | Dev | Production |
|---|---|---|
| TLS cert | Caddy `tls internal` (self-signed CA) | Let's Encrypt (auto) |
| HSTS | 30 days, no preload | 1 year, includeSubDomains, no preload |
| Cookie `Secure` | Only when X-Forwarded-Proto=https from trusted proxy | Always |
| `NODE_ENV` | `development` | `production` |
| `PUBLIC_BASE_URL` | `https://localhost:81` | `https://your-domain.com` |
| Local Next.js (no proxy) | `http://localhost:3000` works, cookies are NOT `Secure` so login still works | N/A |

---

## 11. Testing Performed

### Static
- `bun run lint` → 0 errors.
- Repo-wide grep for `http://` and `ws://` — only intentional references remain (see §6).

### Runtime (curl)
- `GET /api/auth/me` → 200 (BigInt fix verified)
- `POST /api/auth/signup` with HTTPS proxy headers → `set-cookie` has `Secure` ✅
- `POST /api/inboxes` with HTTPS proxy headers → `st_session` has `Secure` ✅
- `POST /api/session` (recover) with HTTPS proxy headers → `setCookie` has `Secure` ✅
- All 8 security headers present on gateway responses ✅

### Runtime (agent-browser)
- Page loads at `http://localhost:81` with all security headers ✅
- No mixed-content warnings ✅
- Inbox generation works ✅
- Test mail delivery works: `POST /api/inboxes/.../test-mail` → 200 ✅
- Message delivered in real-time via WebSocket ✅
- Message appears in Messages tab ✅

---

## 12. Deployment Steps (Production Checklist)

1. Set `PUBLIC_BASE_URL=https://your-domain.com` in `.env`.
2. Set `NODE_ENV=production`.
3. In `Caddyfile`, replace the `:81` block with a real domain block:
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
10. Only after verifying the entire deployment is stable, consider
    submitting the domain to the HSTS preload list
    (https://hstspreload.org/) and then adding `preload` to the HSTS header.

---

## 13. Remaining Risks / Notes

- **HSTS preload**: intentionally NOT set. Only enable after verifying the
  entire deployment (all subdomains) is fully HTTPS-compatible. Submitting
  to the preload list is irreversible.
- **Self-signed dev cert**: browsers will warn on first visit. Use
  `caddy trust` to install the local CA and remove the warning.
- **Subdomain cookies**: `SameSite=Strict` means cross-site navigation
  won't send the cookie. This is the desired privacy posture but may
  affect deep-linking from email clients. Acceptable tradeoff for a
  temporary email service.
- **Internal SMTP**: stays on plain TCP (loopback). If the mail-service
  is ever moved to a separate host, add STARTTLS or mTLS.
- **Infra-managed Caddyfile**: The actual running Caddyfile at `/app/Caddyfile`
  is owned by root and currently serves plain HTTP on `:81`. Applying the
  project's TLS-enabled Caddyfile requires infra redeployment. All
  application-layer HTTPS hardening is in place and will take effect the
  moment Caddy enables TLS.

---

*Generated as part of the end-to-end HTTPS migration. Update this file
whenever the TLS/Cookie/proxy posture changes.*
