# PHASE 15 — Deployment-Ready Package Report

**Date:** 2026-08-25
**Phase:** 15

---

## Issues Found

None — this phase produces deployment artifacts, not code changes.

## Fixes Applied (Artifacts Created)

### 15.1 — TLS / Caddy
- **Created:** `docs/deploy/Caddyfile.production` — parameterized template with `{{DOMAIN}}` placeholder, auto-Let's-Encrypt, HTTP→HTTPS redirect, WebSocket gateway support
- **Created:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` Step 3 — exact `caddy validate`, `systemctl reload caddy`, `curl -sSI https://{{DOMAIN}}` verification commands

### 15.2 — Inbound Mail (Postfix + MX)
- **Created:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` Step 4 — complete Postfix configuration:
  - `main.cf` with `transport_maps` relay to port 2525
  - `transport` file mapping domain → `smtp:[127.0.0.1]:2525`
  - DNS records table (A, MX, SPF, DKIM, DMARC, PTR) with placeholder values
  - DKIM setup via `opendkim`
  - Verification script (send from Gmail, check mail-service logs)

### 15.3 — Git History Cleanup (VAPID Keys)
- **Created:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` Step 5 — exact `git filter-repo` commands:
  - `pip install git-filter-repo`
  - `git clone --mirror`
  - `git filter-repo --replace-text` with all 4 VAPID key variants
  - `git push --force --mirror origin`
  - Collaborator re-clone instructions
- **Verified:** `.env` is in `.gitignore` (confirmed in Phase 1)
- **Created:** `.env.example` — secret-free, fully documented, all variables explained

### 15.4 — Fresh VAPID Keys + Secret Rotation Checklist
- **Created:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` Step 6 — exact `npx web-push generate-vapid-keys` command
- **Created:** Secrets rotation checklist table covering:
  - DATABASE_URL (SQLite → PostgreSQL)
  - VAPID keys (compromised → rotate)
  - TOTP_ENCRYPTION_KEY (new — `openssl rand -hex 32`)
  - RESEND_API_KEY / BREVO_API_KEY (new — sign up)
  - SENTRY_DSN (new — sign up)
  - Admin password (new — create on first run)
- **Confirmed:** "None of the current sandbox values should ever be reused in production"

### 15.5 — CI/CD + Monitoring Setup
- **Created:** `.github/workflows/ci.yml` — GitHub Actions CI pipeline (lint, typecheck, audit, build)
- **Created:** `.github/dependabot.yml` — weekly dependency update PRs
- **Created:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` Step 7 — setup guides for:
  - Sentry (free tier signup, DSN placement)
  - Uptime Robot (free tier, monitor URLs)
  - Google Search Console (domain verification, sitemap submission)
  - Google Postmaster Tools (email deliverability monitoring)

## Verification Performed

- **CI pipeline YAML syntax:** valid GitHub Actions format (lint + typecheck + build steps)
- **Dependabot config:** valid YAML with npm + github-actions ecosystems
- **.env.example:** verified all variables are empty/placeholder (no real secrets)
- **DEPLOYMENT-RUNBOOK.md:** reviewed all 8 steps sequentially — every command is copy-pasteable

## Remaining/Deferred Items

1. **GitHub Actions:** The CI YAML is committed but not "connected" — the human must push to GitHub to activate it. This is a 1-step human action (just `git push`).
2. **External monitoring services:** Sentry, Uptime Robot, Google Search Console, Google Postmaster Tools all require human signup (free tier). Exact signup steps are documented in the runbook.
3. **Real domain + VPS:** The human must buy a domain and provision a VPS. The runbook provides exact commands for Oracle Cloud Always-Free VM.

## Confidence Level

**High** — All artifacts are complete, copy-pasteable, and tested for syntax. The runbook is sequential and self-contained. A human with root access and a real domain can follow it start to finish to go from "code is done" to "live in production."
