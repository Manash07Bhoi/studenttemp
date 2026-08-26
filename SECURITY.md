# Security Policy

StudentTemp is a privacy-first temporary email platform. We take security
and responsible disclosure seriously. This document describes how to report
vulnerabilities, what protections the project ships with, and the explicit
limits of what is supported.

## Supported Versions

Only the latest release on the `main` branch receives security updates.

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | Yes (active dev)   |
| < 1.0   | No                 |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities privately:

1. Go to the repository's **Security** tab > **Advisories** > **New draft advisory**.
2. Or email the maintainer directly via the email listed on the GitHub profile
   of [@Manash07Bhoi](https://github.com/Manash07Bhoi).

Please include:

- A clear description of the issue and its impact.
- The exact commit hash or release tag you tested against.
- A minimal proof of concept (code, request, or steps).
- Any suggested remediation.

You should receive an acknowledgement within 72 hours. We will keep you
informed of remediation progress and coordinate a public disclosure date with
you once a fix is available.

## Threat Model & Scope

In scope:

- Server-side request forgery, authentication bypass, privilege escalation.
- Injection (SQL, HTML, SMTP header, command).
- Secrets exposure (VAPID private keys, TOTP encryption keys, site-access
  passwords, SMTP relay API keys).
- Cross-site scripting, CSRF, open redirects, clickjacking.
- Rate-limit bypass on authentication or credential endpoints.
- Mailbox takeover, recovery token forgery, or message interception.

Out of scope:

- Self-inflicted issues from editing `.env` or `Caddyfile` against the
  documented guidance.
- Vulnerabilities in third-party SaaS the project integrates with (Resend,
  Brevo, Sentry) — report those to the upstream vendor.
- Spam or abuse of the disposable email service itself.

## Security Measures Implemented

The following defenses ship with the project. Each is mapped to the relevant
code location.

### Transport & Cookies

- **HTTPS-only in production.** Caddy terminates TLS with automatic Let's
  Encrypt certificates; Next.js trusts `X-Forwarded-Proto` from the configured
  proxy peer only (`src/proxy.ts`, `TRUSTED_PROXY_HOSTS`).
- **HSTS** is set by Caddy in production (`docs/deploy/Caddyfile.production`).
- **Secure, HttpOnly, SameSite=Lax cookies** for all session and account
  authentication tokens (`src/lib/auth-utils.ts`).
- **Cookie prefixing** (`__Host-` where applicable) to prevent subdomain
  cookie injection.

### Application Headers

- **Content-Security-Policy** is enforced on HTML routes to prevent inline
  script execution, restrict remote sources, and block external resource
  loading from untrusted origins in rendered mail bodies.
- **X-Content-Type-Options: nosniff**, **X-Frame-Options: DENY**,
  **Referrer-Policy: strict-origin-when-cross-origin** are applied globally.

### Authentication & Authorization

- Passwords hashed with **bcrypt** (cost factor 12).
- **TOTP 2FA (RFC 6238)** — secrets are AES-encrypted at rest using
  `TOTP_ENCRYPTION_KEY` (`src/app/api/accounts/2fa/setup/route.ts`).
- **Backup codes** are bcrypt-hashed and single-use.
- **App passwords** for IMAP/SMTP clients are scoped and revocable.
- **Login sessions** are tracked per device with IP hash and revocation list
  (`/api/accounts/sessions`).
- **Site-access gate** with proof-of-work challenge + IP rate limiting
  (`src/components/site-access-gate.tsx`, `/api/site-access/verify`).

### Input Validation & Output Encoding

- All POST/PUT/DELETE endpoints validate bodies with **Zod** schemas.
- Inbound mail HTML is **sanitized** before storage to strip scripts, event
  handlers, remote images, and known-bad markup
  (`src/app/api/inboxes/[id]/receive-mail/route.ts`).
- Mail is rendered in a **sandboxed iframe** (`sandbox=""`) to prevent access
  to the parent document.
- Filenames of attachments are **sanitized**; MIME types are verified via
  magic bytes (not extension).
- SMTP envelope sender validation via **mailauth** (SPF / DKIM / DMARC).

### Rate Limiting

- In-memory token-bucket rate limiter applied to:
  - Site-access verification
  - Login / signup / 2FA verify / 2FA setup / 2FA disable
  - Session recovery / backup-code consumption
  - Inbox creation, message send, abuse reports
  - Contact form
- Buckets are keyed by IP hash (or session ID when authenticated).

### File & Attachment Handling

- **File scanning** for attachments before download using magic-byte
  signatures and an extension allow-list (`src/lib/file-scanner.ts`).
- SHA-256 content hash deduplication and tracking.
- Quarantine status field on every attachment (`scanStatus`).

### Audit & Observability

- **Audit log** of security-relevant actions (login, 2FA enable/disable,
  recovery, admin access, deletion) with IP hash and metadata
  (`prisma/schema.prisma` AuditLog model).
- Optional **Sentry** integration via `SENTRY_DSN`.

## What is NOT Supported

The project targets a constrained cloud-sandbox deployment. The following
are explicitly **not supported** and should not be assumed present:

- **No ClamAV / external antivirus daemon.** Attachment scanning is
  signature-and-magic-byte based (`src/lib/file-scanner.ts`). For full malware
  scanning, deploy ClamAV in a sidecar and wire it into the scanner hook.
- **No Redis.** Rate limiting, session state, and audit buffering are
  in-process. They do not scale horizontally across multiple Next.js replicas.
  Use a single-replica deployment or replace the limiter with Redis before
  scaling out.
- **No external WAF.** Caddy does TLS termination and header injection only.
  Deploy behind Cloudflare / your cloud WAF for L7 filtering.
- **No SSO / SAML / OIDC.** Authentication is the built-in email+password+TOTP
  flow. `next-auth` is listed as a dependency but is currently unused.
- **No outbound SMTP MX.** Outbound mail is sent via a relay provider
  (Resend or Brevo). Inbound MX must be configured separately — see
  `docs/deploy/MX-AND-CADDY-GUIDE.md`.
- **No secrets manager integration.** Secrets are loaded from environment
  variables via `.env` / your hosting provider's secrets UI. Rotate manually.

## Hardening Checklist for Production

Before exposing a deployment to the public internet:

1. Rotate all VAPID keys and the site-access password (do not reuse sandbox
   keys — they may exist in git history).
2. Generate a fresh `TOTP_ENCRYPTION_KEY` with `openssl rand -hex 32`.
3. Set `NODE_ENV=production`.
4. Point `PUBLIC_BASE_URL` at your real HTTPS origin.
5. Configure `TRUSTED_PROXY_HOSTS` to the loopback IP of your reverse proxy.
6. Provision real TLS certificates in Caddy (Let's Encrypt auto).
7. Add MX records pointing at your SMTP relay host.
8. Lock down SMTP `rejectUnauthorized` to loopback only.
9. Set up outbound relay (Resend or Brevo) and store the API key in the
   hosting provider secrets UI — never in the repo.
10. Configure Sentry for production error tracking.

## Contact

Maintainer: [@Manash07Bhoi](https://github.com/Manash07Bhoi)
Developer: Roshan
