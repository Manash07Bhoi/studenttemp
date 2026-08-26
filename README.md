# StudentTemp — Disposable Email for Students & Developers

**Privacy-first temporary email platform.** Generate a disposable inbox in seconds, receive verification codes, protect your real address. No sign-up, no tracking.

**Built By:** Roshan — Full-stack developer

**Contributor:** ManashBhoi ([@Manash07Bhoi](https://github.com/Manash07Bhoi))

---

## Features

- **Real SMTP server** (port 2525) with SPF/DKIM/DMARC verification via `mailauth`
- **94 domains** across 5 categories (Academic, India Student, India General, International, Privacy)
- **7 i18n languages** (English, Hindi, Tamil, Bengali, Telugu, Marathi, Odia)
- **Real-time WebSocket** (Socket.IO) for instant message delivery
- **HTML email sanitization** (DOMPurify in sandboxed iframe)
- **PWA** with service worker, Web Push notifications (VAPID)
- **Account Mode** — signup, login, 2FA (TOTP RFC 6238 via AES-256-GCM encrypted secrets), time-limited mailboxes
- **Admin dashboard** API with admin authorization
- **Site access gate** — password-protected for testing period
- **32+ features**: threading, reply/forward, bulk actions, search, swipe gestures, command palette, App Lock (WebAuthn), labels, filters, contacts, vacation responder, and more

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Real-time | Socket.IO |
| SMTP | `smtp-server` + `mailparser` + `mailauth` |
| Auth | Custom cookie-based (bcrypt + TOTP AES-256-GCM) |
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

# In another terminal, start mail-service (port 2525 + 3003)
cd mini-services/mail-service
bun install
bun run index.ts
```

The app runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. Key variables:

| Variable | Purpose | How to Generate |
|----------|---------|----------------|
| `DATABASE_URL` | Database connection | SQLite for dev, PostgreSQL URL for prod |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Web Push private key | Same command as above |
| `SITE_ACCESS_PASSWORD_HASH` | Site gate password (SHA-256) | `echo -n 'yourpassword' \| sha256sum` |
| `TOTP_ENCRYPTION_KEY` | 2FA secret encryption (32 bytes hex) | `openssl rand -hex 32` |
| `RESEND_API_KEY` | Outbound email relay | Sign up at resend.com |
| `PUBLIC_BASE_URL` | Your deployment URL | Set after deploy |

See `.env.example` for the complete list.

## CI/CD

The project includes 10 GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CI | push, PR | Lint + typecheck + build |
| Security | push, PR, weekly | Dependency audit + secret scan + CodeQL SAST |
| PR Validation | PR | Conventional Commits + code quality + .env guard |
| Performance | push, PR | Bundle size measurement |
| Code Quality | push, PR | ESLint strict (max-warnings=0) |
| Release | Tag `v*.*.*` | GitHub Release with changelog |
| SBOM | dep changes, release | CycloneDX software bill of materials |
| Accessibility | PR | axe-core WCAG 2.0 A/AA testing |
| E2E | push, PR | Playwright test framework |
| Smoke Test | After release | Post-deployment HTTPS + API verification |

## Security

- **Secure cookies**: HttpOnly, Secure, SameSite=Strict
- **8 security headers**: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP
- **TOTP 2FA**: AES-256-GCM encrypted secrets (not XOR)
- **Admin authorization**: Email allowlist with DB-verified identity
- **Webhook verification**: HMAC-SHA256 with timing-safe comparison
- **Rate limiting**: On auth, signup, login, inbox creation, site access
- **HTML sanitization**: DOMPurify strips scripts from email HTML
- **File scanner**: Magic bytes validation, blocks executables
- **Trusted proxy middleware**: Strips forged headers from non-proxy peers
- **Internal API authentication**: Shared secret on broadcast endpoint

See `SECURITY.md` for the full security policy and `docs/audit/` for audit reports.

## Testing

```bash
# Lint (0 errors required)
bun run lint

# Type check (0 production errors required)
npx tsc --noEmit --skipLibCheck

# Security audit
bun audit

# API smoke test
curl -X POST http://localhost:3000/api/inboxes \
  -H 'Content-Type: application/json' \
  -d '{"domain":"studentbox.in","lifetimeMinutes":10}'
```

## Deployment

**Status: NOT PRODUCTION READY**

The PostgreSQL database is provisioned on Render. However, the Web Service and Mail Worker are blocked because Render lacks authorization to fetch the private GitHub repository. A human must authorize Render to access `Manash07Bhoi/studenttemp` before deployment can complete.

### Render (recommended — free tier supports both web + worker)

1. Create a PostgreSQL database on Render
2. Create a Web Service from this repo (build: `bun install && bun run build`, start: `bun run start`)
3. Create a Background Worker for the mail-service
4. Set environment variables (see `.env.example`)
5. Push database schema: `bun run db:push`

See `docs/deploy/DEPLOYMENT-RUNBOOK.md` for the complete guide.

### When you have a domain

- Configure MX/SPF/DKIM/DMARC records (see `docs/deploy/MX-AND-CADDY-GUIDE.md`)
- Set up Postfix on port 25 relaying to the mail-service on port 2525
- Configure Caddy with your domain for automatic HTTPS

## Known Limitations

- **External mail receiving**: Requires a real domain with MX records and Postfix on port 25. Until then, use the "Receive Mail" bridge API to simulate inbound mail.
- **Real-time push on serverless**: The mail-service (SMTP + Socket.IO) requires a persistent process — not compatible with Cloudflare Pages or Vercel. Use Render, Railway, or a VPS.
- **Screenshots**: Not included in the repository. Run the app locally or deploy it to capture real screenshots for your README.

## Architecture

```
Browser → Caddy (TLS) → Next.js (:3000) → Prisma → SQLite/PostgreSQL
                      → mail-service (:2525 SMTP, :3003 Socket.IO)
```

## Project Structure

See `docs/COMPLETE-PROJECT-GUIDE.md` for a beginner-friendly explanation of every file and folder.

## Contributing

See `CONTRIBUTING.md`. All contributions must pass lint, typecheck, and PR validation checks.

## Release Process

1. Update `CHANGELOG.md`
2. Tag: `git tag v1.0.1`
3. Push tag: `git push origin v1.0.1`
4. The Release workflow automatically builds, verifies, and creates a GitHub Release

## License

MIT License — see `LICENSE`.

## Support

- GitHub Issues: https://github.com/Manash07Bhoi/studenttemp/issues
- See `SUPPORT.md` for more options
