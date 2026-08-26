# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- Audit remediation in progress (see `worklog.md` task AUDIT-1).

## [1.0.0] - 2026-01-15

First stable release of StudentTemp — a privacy-first temporary email
platform built on Next.js 16, Prisma, Socket.IO, Tailwind CSS 4, and
shadcn/ui.

### Added

#### Inbox & Mail
- Disposable inbox creation across 94 domains in 5 packs (Academic .edu/.ac.in,
  India Student, India General, International, Privacy).
- Real SMTP server on port 2525 with SPF / DKIM / DMARC verification via
  `mailauth`; auth results are stored per message.
- Real-time message delivery over Socket.IO (port 3003) — instant push the
  moment an inbound SMTP message is parsed.
- HTML email rendering in a sandboxed iframe with DOMPurify-style
  sanitization; remote resources blocked and counted per message.
- Time-limited inboxes with burn-on-read and auto-expiry.
- Custom aliases with anti-squatting cooldown ledger.
- Attachment handling with SHA-256 deduplication, magic-byte MIME
  verification, and quarantine status (`src/lib/file-scanner.ts`).
- Message threading, reply, forward, report-as-spam, export to EML/MBOX.
- Bulk actions: archive, mark read/unread, delete, star, label.
- Full-text search across sender, subject, and body.
- Swipe gestures and pull-to-refresh on mobile.

#### Account Mode
- Permanent email accounts (signup / login / logout) with bcrypt password
  hashing.
- Real TOTP 2FA (RFC 6238) with AES-encrypted secret at rest.
- Single-use backup codes (bcrypt-hashed).
- App passwords for IMAP/SMTP clients, revocable, labeled.
- Per-device login session tracking with revoke.
- Storage quota (5 GB default) and usage tracking.
- Grace-period deletion with scheduled purge.
- Vacation auto-responder with contact-only mode and loop prevention.
- Nested labels with retention rules and system labels (Inbox, Starred,
  Sent, Drafts, Spam, Trash, All Mail).
- Filters with priority ordering and stop-processing semantics.
- Per-alias signatures.
- Drafts with auto-save.
- Contacts with auto-suggested and manual sources.
- Outbound send via Resend or Brevo relay with delivery, bounce, and open
  tracking; MDN read-receipt requests; confidential mode with expiry.

#### App Lock (Local Device Protection)
- 4-6 digit PIN protected with PBKDF2-SHA256 (100k iterations) and AES-GCM.
- Biometric unlock via WebAuthn platform authenticator (Touch ID / Face ID /
  Windows Hello) as a UX shortcut with PIN fallback.
- Auto-lock on tab visibility change with zero flash-of-unlocked-content.
- Escalating cool-down after repeated failed attempts (15s → 30s → 60s → 5min).

#### PWA & Notifications
- Installable PWA with service worker (`public/sw.js`) and manifest
  (`public/manifest.json`).
- Web Push notifications with real VAPID keys (rotate before production).
- Pull-to-refresh, offline shell, theme-color meta.

#### UX & Accessibility
- Command palette (`Cmd+K` / `Ctrl+K`) for global navigation and actions.
- Keyboard shortcuts dialog and full keyboard navigation.
- Dark / light / system theme with `next-themes`.
- 7 i18n locales: English, Hindi, Tamil, Bengali, Telugu, Marathi, Odia.
- Mobile-first responsive layout with sticky footer.
- Framer Motion transitions on key interactive surfaces.
- Onboarding overlay for first-time users.
- Toast notifications via Sonner.

#### Privacy & Compliance
- DPDP consent banner (India DPDP Act 2023).
- Legal documents (Privacy Policy, Terms of Service, DPDP) served from
  `/api/legal/[doc]`.
- Anonymous session model — no sign-up required for disposable inboxes.
- IP hashing in audit logs and rate-limit buckets.

#### Security
- Site-access gate with proof-of-work challenge and IP rate limiting.
- Secure, HttpOnly, SameSite=Lax session cookies.
- Content-Security-Policy enforced on HTML routes.
- HSTS and TLS termination via Caddy in production.
- In-memory rate limiter on authentication, credential, and abuse endpoints.
- Audit log of security-relevant actions.
- File scanning for attachments (no ClamAV — see `SECURITY.md`).

#### Admin
- Admin stats endpoint exposing system-wide counts.

#### Observability
- Optional Sentry integration (`SENTRY_DSN`).

### Infrastructure
- Next.js 16 standalone output build.
- Caddy reverse proxy configuration for TLS termination and routing.
- Prisma schema with SQLite (dev) and PostgreSQL-compatible models.
- Mail-service mini-service: SMTP server + Socket.IO gateway.
- CI workflow with ESLint, type check, and build verification
  (`.github/workflows/ci.yml`).
- Dependabot configured for dependency updates (`.github/dependabot.yml`).

### Known Limitations
- Rate limiter is in-process; not horizontally scalable without Redis
  (not bundled — see `SECURITY.md`).
- Attachment scanning is signature- and magic-byte-based; no ClamAV
  integration (see `SECURITY.md`).
- `next-auth` dependency is currently unused.

### Credits
- Developed by Roshan.
- Contributor: ManashBhoi ([@Manash07Bhoi](https://github.com/Manash07Bhoi)).

[Unreleased]: https://github.com/Manash07Bhoi/StudentTemp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Manash07Bhoi/StudentTemp/releases/tag/v1.0.0
