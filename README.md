# StudentTemp — Disposable Email for Students & Developers

**Privacy-first temporary email platform.** Generate a disposable inbox in seconds, receive verification codes, protect your real address. No sign-up, no tracking.

**Built By:** [Roshan](https://github.com/roshan) — Full-stack developer

---

## Features

- ✅ **Real SMTP server** (port 2525) with SPF/DKIM/DMARC verification via `mailauth`
- ✅ **94 domains** across 5 categories (Academic .edu/.ac.in, India Student, India General, International, Privacy)
- ✅ **7 i18n languages** (English, Hindi, Tamil, Bengali, Telugu, Marathi, Odia)
- ✅ **Real-time WebSocket** (Socket.IO) for instant message delivery
- ✅ **HTML email sanitization** (DOMPurify in sandboxed iframe)
- ✅ **PWA** with service worker, Web Push notifications (real VAPID keys)
- ✅ **Account Mode** — signup, login, 2FA (real TOTP RFC 6238), time-limited mailboxes
- ✅ **Admin dashboard** API with system stats
- ✅ **32+ features**: threading, reply/forward, bulk actions, search, swipe gestures, command palette, App Lock (WebAuthn), and more

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite (PostgreSQL-compatible) |
| Real-time | Socket.IO (port 3003) |
| SMTP | `smtp-server` + `mailparser` + `mailauth` (port 2525) |
| Auth | Custom cookie-based (bcrypt + TOTP) |
| PWA | Service Worker + Web Push (VAPID) |
| Reverse Proxy | Caddy (TLS termination) |

## Quick Start

```bash
# Install dependencies
bun install

# Set up database
bun run db:push

# Start dev server (port 3000)
bun run dev

# Start mail-service (port 2525 + 3003)
cd mini-services/mail-service
bun install
bun run dev
```

The app runs at `http://localhost:3000`. The Caddy gateway is at `http://localhost:81`.

## Environment Variables

Create a `.env` file (never committed to git):

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db

# VAPID keys (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>

# SMTP relay (internal loopback)
SMTP_RELAY_HOST=localhost
SMTP_RELAY_PORT=2525

# Trusted proxy
TRUSTED_PROXY_HOSTS=127.0.0.1,::1,localhost
PUBLIC_BASE_URL=https://localhost:81
NODE_ENV=development
```

## Architecture

```
Browser → Caddy (:81, TLS) → Next.js (:3000) → Prisma → SQLite
                          → mail-service (:2525 SMTP, :3003 Socket.IO)
```

- **Caddy** terminates TLS and forwards `X-Forwarded-Proto` to Next.js
- **Next.js** serves the UI and API routes
- **mail-service** receives real SMTP mail and pushes via WebSocket
- **Prisma** provides type-safe database access

## Testing

```bash
# Lint
bun run lint

# Type check
npx tsc --noEmit

# Security audit
bun audit

# Create inbox via API
curl -X POST http://localhost:3000/api/inboxes \
  -H 'Content-Type: application/json' \
  -d '{"domain":"studentbox.in","lifetimeMinutes":10}'

# Send test email
curl -X POST http://localhost:3000/api/inboxes/<inbox-id>/test-mail
```

## Deployment

See `docs/HTTPS-AUDIT.md` for TLS configuration and `docs/decisions/OPEN-QUESTIONS.md` for architectural decisions requiring human sign-off.

**Production checklist:**
1. Set `NODE_ENV=production`
2. Set `PUBLIC_BASE_URL=https://your-domain.com`
3. Provision PostgreSQL and update `DATABASE_URL`
4. Configure Caddy with real domain (Let's Encrypt auto)
5. Install ClamAV for attachment scanning
6. Set up MX records pointing to your mail server
7. Rotate VAPID keys (do not reuse sandbox keys)

## Credits

**Developed by Roshan** — Full-stack developer

**Contributor:** ManashBhoi ([@Manash07Bhoi](https://github.com/Manash07Bhoi))

Built with Next.js, Prisma, Socket.IO, Tailwind CSS, and shadcn/ui.

## License

Private project. All rights reserved.
