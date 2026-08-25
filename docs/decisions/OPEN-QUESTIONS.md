# Open Questions — Architectural Decisions Requiring Human Sign-Off

**Created:** 2026-08-25
**Source:** Phase 0 Discovery & Inventory

Per MASTER-AUDIT-PROMPT Rule 4 (Never silently change a locked architectural decision) and Rule 7 (Log ambiguity in OPEN-QUESTIONS.md), the following deviations from the spec's locked technology decisions have been identified. They are **sandbox-environment-driven** and require human sign-off before production deployment.

---

## OQ-1: TypeScript mail-service instead of Go

**Spec says:** Go for the mail gateway & security core (AGENT.md §3).
**Actual:** The mail-service (`mini-services/mail-service/index.ts`) is written in TypeScript using `smtp-server`, `mailparser`, `mailauth`, and `jsdom`/`dompurify`.

**Reason:** The sandbox environment does not have a Go toolchain installed, and the project was bootstrapped as a Next.js + TypeScript monorepo. The TypeScript implementation uses the same real libraries (mailauth for SPF/DKIM/DMARC, mailparser for MIME, DOMPurify for sanitization) and produces real verification results.

**Risk:** Lower concurrency throughput under heavy load (Node single-thread vs Go goroutines). Acceptable for sandbox/dev. For production at scale, a Go rewrite is recommended.

**Safe default chosen:** Keep TypeScript implementation (it works and is verified). Flag for human sign-off before scaling to production traffic.

**Action required:** Human must decide whether to:
- (a) Keep TypeScript mail-service for production (acceptable if traffic is low)
- (b) Rewrite the mail gateway in Go before production launch

---

## OQ-2: SQLite instead of PostgreSQL

**Spec says:** PostgreSQL (Neon/Supabase free tier) as the source of truth.
**Actual:** SQLite via Prisma (`DATABASE_URL=file:/home/z/my-project/db/custom.db`).

**Reason:** The sandbox does not have network access to a free-tier PostgreSQL instance, and SQLite is the only database that works in this environment without external dependencies.

**Risk:** SQLite has limited concurrency (single writer), no built-in replication, and no TTL-friendly features. The Prisma schema is database-agnostic, so switching to PostgreSQL is a config change (`DATABASE_URL`).

**Safe default chosen:** Keep SQLite for dev/sandbox. The schema is PostgreSQL-compatible (no SQLite-specific types used except `Bytes` which maps to `BigInt`).

**Action required:** Human must provision a PostgreSQL instance (Neon/Supabase free tier) and update `DATABASE_URL` before production deployment. Run `bun run db:push` to create the schema on the new database.

---

## OQ-3: In-memory rate limiting instead of Redis

**Spec says:** Redis (Upstash free tier) for rate limiting, pub/sub, and TTL keys.
**Actual:** In-memory token bucket (`Map<string, Bucket>`) in `src/lib/mail-utils.ts`.

**Reason:** No Redis available in the sandbox. The in-memory implementation is correct for single-instance deployments but does not scale horizontally.

**Risk:** Rate limits are per-process, not per-IP-across-instances. If multiple server instances are deployed, each has its own bucket, effectively multiplying the rate limit.

**Safe default chosen:** In-memory for dev. The `RateLimitBucket` table exists in the schema for future DB-backed rate limiting.

**Action required:** Human must provision Redis (Upstash free tier) and replace the in-memory implementation before horizontal scaling.

---

## OQ-4: smtp-server (npm) on port 2525 instead of Postfix on port 25

**Spec says:** Postfix on Oracle Cloud Always-Free VM for inbound SMTP (port 25).
**Actual:** `smtp-server` npm package on port 2525 (non-privileged).

**Reason:** Port 25 requires root privileges (not available to user `z`), and no Postfix is installed in the sandbox. The `smtp-server` library implements the same RFC 5321 SMTP protocol.

**Risk:** External mail providers (Gmail, Outlook, Lovable) cannot reach port 2525 because:
1. No MX record points to this host
2. The sandbox IP is not publicly routable for SMTP
3. Port 2525 is non-standard

**Safe default chosen:** Local SMTP on 2525 for testing. The "Receive Mail" bridge API simulates external mail delivery for users.

**Action required:** Human must deploy Postfix on a real server with:
- Port 25 bound (requires root)
- MX record pointing to the server
- Postfix configured to relay to the mail-service on port 2525 (or replace the mail-service entirely)

---

## OQ-5: File-scanner instead of ClamAV

**Spec says:** ClamAV for malware scanning (MASTER-CHECKLIST §1, §5).
**Actual:** Custom file-scanner (`src/lib/file-scanner.ts`) using magic bytes validation, PE/ELF detection, and size limits.

**Reason:** ClamAV is not installed in the sandbox and requires significant system resources (100MB+ RAM for the daemon).

**Risk:** The custom scanner detects known-bad file types (executables, scripts) by magic bytes but does NOT have ClamAV's full signature database. It will NOT detect polymorphic malware or zero-day exploits.

**Safe default chosen:** Custom scanner for dev (blocks executables, validates magic bytes). The `Attachment.scanStatus` field supports `clean`/`quarantined`/`failed` for future ClamAV integration.

**Action required:** Human must install ClamAV on the production server and wire it into `mini-services/mail-service/index.ts` (the `scanFile()` call site). Test with the EICAR test file.

---

## OQ-6: SHA-256 PoW instead of Cloudflare Turnstile

**Spec says:** Cloudflare Turnstile for challenge/response (WORKFLOWS.md).
**Actual:** SHA-256 proof-of-work challenge (`src/lib/pow-challenge.ts`).

**Reason:** Cloudflare Turnstile requires a Cloudflare account and site key, which are not available in the sandbox.

**Risk:** PoW challenges are accessible to automated solvers (unlike Turnstile's browser fingerprinting). A determined attacker with GPU resources can solve them faster than a human.

**Safe default chosen:** PoW for dev (raises the bar for abuse without external dependencies). The `/api/challenge` endpoint is designed to be swappable.

**Action required:** Human must register for Cloudflare Turnstile (free) and replace the PoW implementation in `src/lib/pow-challenge.ts` and `src/app/api/challenge/route.ts`.

---

## OQ-7: No external SMTP reachability (sandbox limitation)

**Spec says:** Real email from external providers (Gmail/Outlook) should arrive in the inbox (MASTER-CHECKLIST §4).
**Actual:** External mail cannot reach the sandbox SMTP server (no MX record, no port 25, not publicly routable).

**Reason:** The sandbox is an isolated container with no inbound mail routing.

**Risk:** Users cannot receive real verification emails from external services (Lovable, Google, GitHub, etc.) in the sandbox.

**Safe default chosen:** Built the "Receive Mail" bridge API (`/api/inboxes/[id]/receive-mail`) that lets users simulate receiving external emails. This is clearly labeled as a bridge and not a real SMTP path.

**Action required:** Human must deploy to a real server with:
- Postfix on port 25
- MX record pointing to the server
- Public IP address
Then the "Receive Mail" bridge can be removed or kept as a testing tool.

---

## Decision Log

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-08-25 | Keep TypeScript mail-service | No Go toolchain in sandbox; TS implementation is real and verified | Awaiting human sign-off |
| 2026-08-25 | Keep SQLite for dev | No PostgreSQL access in sandbox; Prisma schema is PG-compatible | Awaiting human sign-off |
| 2026-08-25 | Keep in-memory rate limiting | No Redis in sandbox; RateLimitBucket table ready for DB-backed impl | Awaiting human sign-off |
| 2026-08-25 | Keep smtp-server on 2525 | No root for port 25; library implements RFC 5321 | Awaiting human sign-off |
| 2026-08-25 | Keep custom file-scanner | No ClamAV in sandbox; blocks executables by magic bytes | Awaiting human sign-off |
| 2026-08-25 | Keep SHA-256 PoW | No Cloudflare account; PoW raises abuse bar | Awaiting human sign-off |
| 2026-08-25 | Built Receive Mail bridge | External mail can't reach sandbox; users need to test verification flows | Awaiting human sign-off (remove when real SMTP is available) |
