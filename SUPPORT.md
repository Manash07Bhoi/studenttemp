# Support

StudentTemp is a privacy-first temporary email platform. This document lists
the channels available to get help, report problems, and find deployment
information.

## Where to Get Help

### 1. Read the docs first

Most questions are answered in the repository itself:

| Topic | File |
|-------|------|
| Project overview & quickstart | `README.md` |
| Architecture & decisions | `docs/COMPLETE-PROJECT-GUIDE.md`, `docs/decisions/OPEN-QUESTIONS.md` |
| HTTPS / TLS setup | `docs/HTTPS-AUDIT.md` |
| SMTP & MX configuration | `docs/SMTP-SETUP.md`, `docs/deploy/MX-AND-CADDY-GUIDE.md` |
| Deployment runbook | `docs/deploy/DEPLOYMENT-RUNBOOK.md` |
| Free-tier deployment status | `docs/deploy/FREE-DEPLOY-STATUS.md` |
| Security policy | `SECURITY.md` |
| Contributing guide | `CONTRIBUTING.md` |
| Change history | `CHANGELOG.md` |

### 2. Open a GitHub Issue

If the docs do not answer your question, open an issue on GitHub using the
appropriate template:

- **Bug report**: `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature request**: `.github/ISSUE_TEMPLATE/feature_request.md`

Blank issues are disabled — use the templates so the maintainers have the
information needed to triage.

When opening a bug report, include:

- Steps to reproduce.
- Expected vs actual behavior.
- The exact browser, OS, and device.
- Whether you can reproduce on the public deployment or only locally.
- Screenshots or screen recordings if applicable.

### 3. Site Access Password

The public StudentTemp deployment is gated behind a **site-access password**
plus a proof-of-work challenge to deter automated abuse. If you have been
given a password, enter it on the access-gate screen; the PoW challenge runs
client-side and unlocks the app on success.

If you do not have the password:

- You are a contributor or tester — request one from the maintainer.
- You found the deployment by accident — the project is not currently open
  to the general public; please respect the gate.

Lost or leaked passwords should be reported privately — see `SECURITY.md`.

### 4. Security vulnerabilities

Do **not** open a public issue for security vulnerabilities. Follow the
private disclosure process in `SECURITY.md` instead.

### 5. Deployment help

- For self-hosting, follow `docs/deploy/DEPLOYMENT-RUNBOOK.md` end to end.
- For Render-specific configuration, see `render.yaml` and `docs/deploy/`.
- For Cloudflare Pages, see `wrangler.toml` and `deploy-cloudflare.sh`.
  Note: the project supports one deployment target at a time — Render
  **or** Cloudflare Pages, not both.

## Response Times

StudentTemp is maintained by a small team. Reasonable expectations:

- Issue acknowledgement: within 72 hours.
- First substantive response: within 7 days.
- Security reports: see `SECURITY.md` for the SLA.

## What is NOT Supported

- Self-hosting on architectures other than x86_64 Linux.
- SQLite in production — use the PostgreSQL connection string in
  `DATABASE_URL`.
- Running the mail-service SMTP server (port 2525) on a host where port 25
  is blocked by your ISP — use a relay provider for outbound instead.
- Hot-reloading of the SMTP server across multiple Next.js replicas without
  external state (see `SECURITY.md`).

## Maintainers

- **Developer**: Roshan
- **Repository owner / contributor**: ManashBhoi
  ([@Manash07Bhoi](https://github.com/Manash07Bhoi))

## Responsible Disclosure

If you believe you have found a security issue, please read `SECURITY.md`
**before** opening any public issue or posting publicly.
