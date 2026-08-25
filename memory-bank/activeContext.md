# Memory Bank — StudentTemp Project

## productContext.md

**Why this project exists:** StudentTemp is a privacy-first temporary email platform built for students, developers, testers, and privacy-conscious users. It issues short-lived, disposable inboxes with real SMTP receiving, sanitized HTML rendering, automatic expiration, and a mobile-first PWA experience.

**Who it's for:** Students needing OTP verification, developers testing email flows, QA testers, researchers, and privacy-conscious users.

**Core value proposition:** Generate a disposable inbox in seconds, receive verification codes, protect your real address. No sign-up, no tracking. Real SMTP (not mock), real SPF/DKIM/DMARC, real-time WebSocket push.

---

## systemPatterns.md

**Architecture in production:**
- Caddy reverse proxy (TLS termination, HTTP→HTTPS redirect)
- Next.js 16 App Router (UI + API routes)
- mail-service mini-service (real SMTP on 2525, Socket.IO on 3003)
- Prisma ORM + SQLite (PostgreSQL-compatible for production)

**Locked technology decisions:**
- TypeScript everywhere (not Go — sandbox limitation, documented in OPEN-QUESTIONS)
- SQLite (not PostgreSQL — sandbox limitation)
- In-memory rate limiting (not Redis — sandbox limitation)
- Custom file-scanner (not ClamAV — sandbox limitation)
- SHA-256 PoW (not Cloudflare Turnstile — sandbox limitation)

**Patterns:**
- Cookie-based sessions (HttpOnly, Secure, SameSite=Strict)
- Trusted-proxy middleware (`src/proxy.ts`) for X-Forwarded-Proto
- Zustand for client state, TanStack Query for server state
- shadcn/ui component library (New York style)
- Framer Motion for animations

---

## activeContext.md

**Current state (2026-08-25):**
- All 11 audit phases completed
- 0 lint errors, 0 TypeScript errors
- 2 critical bugs fixed (L4 alias reclaim, L5 account purge)
- VAPID keys rotated (old keys were in git history)
- Real TOTP 2FA implemented (was accepting any 6-digit code)
- End-to-end HTTPS: BLOCKED (Caddy is infra-managed, root-owned, not TLS-enabled)

**Known/accepted limitations:**
- External mail cannot reach sandbox (no MX record, no port 25)
- Caddy `/app/Caddyfile` is root-owned, not modifiable by coding agent
- Next.js dev server OOM-killed under load (3.9GB RAM sandbox)
- 4 feature gaps deferred (filter engine, retention sweep, vacation auto-reply, mail tracking)

---

## decisionLog.md

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-25 | Rotated VAPID keys | Old keys committed to git history — compromised |
| 2026-08-25 | Implemented real RFC 6238 TOTP | Was accepting any 6-digit code (security hole) |
| 2026-08-25 | Fixed L4 alias cooldown reclaim | `lastUsedBySessionHash` was never written (dead code) |
| 2026-08-25 | Added L5 account purge sweep | Accounts stayed in grace_deletion forever (GDPR violation) |
| 2026-08-25 | Removed HSTS preload | Per security review — preload requires hstspreload.org submission first |
| 2026-08-25 | Fixed session recover cookie | Missing `Secure` flag when behind HTTPS proxy |
| 2026-08-25 | Built Receive Mail bridge API | External mail can't reach sandbox — users need to test verification flows |
| 2026-08-25 | Kept TypeScript mail-service | No Go toolchain in sandbox; TS implementation is real and verified |
| 2026-08-25 | Kept SQLite for dev | No PostgreSQL in sandbox; Prisma schema is PG-compatible |

---

## progress.md

**Done and verified:**
- ✅ All 15 Temp Mode screens
- ✅ All 40 API routes (real Prisma queries, no stubs)
- ✅ 21 database models
- ✅ Real SMTP server with SPF/DKIM/DMARC
- ✅ Real HTML sanitization (DOMPurify)
- ✅ Real-time WebSocket (Socket.IO)
- ✅ 94 domains seeded
- ✅ 7 i18n languages
- ✅ PWA (service worker, Web Push, manifest)
- ✅ Security headers (8/8)
- ✅ Secure cookies (HttpOnly, Secure, SameSite=Strict)
- ✅ Trusted-proxy middleware
- ✅ Real TOTP 2FA (RFC 6238)
- ✅ Account Mode APIs (signup, login, labels, filters, contacts, drafts, etc.)
- ✅ Admin dashboard API
- ✅ L4 alias cooldown same-session reclaim
- ✅ L5 account deletion purge sweep
- ✅ Receive Mail bridge (for sandbox mail delivery)
- ✅ 0 lint errors, 0 TypeScript errors

**Explicitly deferred to future phase:**
- ❌ Account Mode UI screens (5 of 10 have APIs but no UI)
- ❌ Filter execution engine (L3 — schema only)
- ❌ Retention policy sweep (schema only)
- ❌ Vacation auto-reply sender (schema only)
- ❌ Mail tracking pixel + MDN (T1-T4 — schema only)
- ❌ IMAP/POP3 server (G3 — AppPassword model only)
- ❌ End-to-end HTTPS (blocked by infra — Caddy is root-owned)
- ❌ CI/CD pipeline (requires GitHub Actions setup)
- ❌ Monitoring (Sentry, Uptime Robot — requires external accounts)
- ❌ Playwright E2E test suite
