# 📄 FILE: `COMPLETION-SPRINT-PROMPT.md`
### Master Prompt — Complete Account Mode, Close All 4 Feature Gaps, and Produce Deployment-Ready Package

This is the next master prompt in the sequence. It continues directly from your prior audit work (`FINAL-AUDIT-SUMMARY-V2.md`, `docs/decisions/OPEN-QUESTIONS.md`, `memory-bank/*`) — it does **not** restart from zero. Paste the entire block below to your AI coding agent.

---

```
═══════════════════════════════════════════════════════════════════
  COMPLETION SPRINT — ACCOUNT MODE + FEATURE GAPS + DEPLOY-READY
═══════════════════════════════════════════════════════════════════
```

## 0. CONTEXT — READ FIRST, DO NOT SKIP

This is a **continuation sprint**, not a new project. Before writing any code, read in full:
- `docs/audit/FINAL-AUDIT-SUMMARY-V2.md` (your own prior verified findings)
- `memory-bank/activeContext.md`, `memory-bank/progress.md`, `memory-bank/decisionLog.md`
- `docs/decisions/OPEN-QUESTIONS.md`
- `PRD-ADDENDUM-ACCOUNTS.md`, `SCREENS-ACCOUNTS.md`, `LOGIC-TREES-GLOBAL.md`, `DATABASE-ADDENDUM-ACCOUNTS.md`

You have already confirmed: Temp Mode is fully working end-to-end, 0 lint/TS errors, 6 NO-GO blockers exist. Your job now is to close **5 of those 6 blockers that are actually code work** (Account Mode UI, 4 feature gaps) and produce a **ready-to-execute deployment package** for the 1 blocker that requires the human (real domain, root, VPS).

## 1. NON-NEGOTIABLE RULES (unchanged from before — restate briefly, then proceed)

Same 8 rules as `MASTER-AUDIT-PROMPT.md`: zero mock/dummy/fake data or logic, zero TODO/console.log in production, never fabricate a test result, never silently deviate from locked architecture without logging it, every fix traceable, no checklist item marked done without real verification evidence, log ambiguity to `OPEN-QUESTIONS.md` with the safest default chosen, preserve "Developed by Roshan" credit everywhere.

**Additional rule for this sprint:** Every feature you build must be **fully wired end-to-end** — UI → API → database → real behavior. A screen that renders but doesn't actually call the real API, or an API that exists but has no UI, is **not acceptable as "done."** Both sides must exist and be connected before you report a feature complete.

---

## PHASE 12 — Account Mode UI (Build All Missing/Partial Screens)

Build every screen below to full functional completion, matching `SCREENS-ACCOUNTS.md` specs exactly (layout, states, conditional logic). For each screen, confirm it is reachable via real navigation (not just a route that exists with no link to it), and wire it to the real, already-existing backend APIs — do not create new fake APIs, and do not leave any screen calling a stub.

### 12.1 — Sign Up / Login (Screen A1)
- [ ] Full form with live username-availability check (debounced, real API call)
- [ ] Password strength meter (real validation, not decorative)
- [ ] OTP verification path if phone signup selected
- [ ] Correct error states (username taken, weak password, network failure with data preserved)
- [ ] Routes to Profile Setup (12.2) on success — **not directly to Inbox**, matching spec

### 12.2 — Profile Setup (Screen A2)
- [ ] 5-step flow: photo/avatar, display name, recovery email/phone (mandatory, not skippable), language/theme, signature/contacts import (skippable)
- [ ] Monogram-avatar fallback wired for real when photo upload fails or is skipped
- [ ] "Finish Setup" persists all fields to the `accounts` table for real, then routes to Account Home

### 12.3 — Account Home / Inbox (Screen A3) — verify/complete
- [ ] Confirm left rail (labels), category tabs, message list, Compose FAB are all present and functional
- [ ] Confirm thread grouping (G1) actually renders grouped conversations, not a flat list
- [ ] Multi-select bulk actions (G12) implemented and wired to real bulk API calls

### 12.4 — Compose (Screen A4) — verify/complete
- [ ] Reply / Reply All / Forward (G2) correctly pre-fill recipients/subject/quoted text
- [ ] Undo Send window functional (configurable 5/10/20/30s) — verify by checking the outbound relay is genuinely NOT called until the window elapses
- [ ] Autosave-to-Drafts on inactivity, verified by checking a real `drafts` row is created/updated

### 12.5 — Labels & Filters Manager (Screen A5) — build from scratch
- [ ] Labels tab: create/rename/delete, color picker, **retention-days input per label** (this UI is the missing piece that makes Feature Gap #2 usable — build it now, wire it to Phase 13's real retention sweep)
- [ ] Filters tab: condition/action rule builder, drag-to-reorder priority list, plain-language preview before saving
- [ ] This UI must call real filter CRUD APIs — confirm by creating a filter and querying the database directly to confirm the row exists with correct `conditions`/`actions` JSON

### 12.6 — Contacts (Screen A6) — build from scratch
- [ ] List/search/add/edit/delete contacts, groups
- [ ] "Add from recent correspondence" — must query real `threads`/`sent_messages` data, not a hardcoded suggestion list

### 12.7 — Storage & Data Settings (Screen A7) — build from scratch
- [ ] Real storage usage meter — must compute actual bytes used from real message/attachment sizes in the database, not an estimate
- [ ] Export All Data — generates a real `.zip` of real `.eml` files (verify by actually opening one of the generated files)
- [ ] Delete Account button wired to the real grace-deletion flow (L5) already fixed in Phase 2 of the prior audit

### 12.8 — Security Settings / 2FA (Screen A8) — build from scratch
- [ ] TOTP setup: real QR code generation (using the real secret, not a placeholder image), backup codes generation (10 single-use, downloadable)
- [ ] Wire to the real `verifyTOTP` function already implemented in `auth-utils.ts` during the prior audit
- [ ] Active sessions list — must show real `login_sessions` rows, with working "Sign out" per device

### 12.9 — Account Switcher (Screen A9) — build from scratch
- [ ] Lists all real logged-in sessions on this device (Temp + Account), "Add another account," "Sign out of all" — all wired to real session data

### 12.10 — Vacation Responder Settings (Screen A10) — build from scratch
- [ ] UI for toggle, date range, subject/body, "send only to contacts" checkbox
- [ ] Wire this UI to Phase 13.3's real vacation-responder sending logic

### 12.11 — Admin Dashboard — verify/complete
- [ ] System status, metrics, domain management, abuse queue, audit log viewer — confirm each panel pulls real data (real counts from real tables), not hardcoded example numbers

**Phase 12 verification requirement:** For every screen above, perform a real click-through in a running browser session (or automated Playwright test), and for at least 3 screens per session, query the actual database afterward to confirm the UI action produced a real, correct database change.

---

## PHASE 13 — Implement the 4 Schema-Only Feature Gaps With Real Logic

These were confirmed to have database tables but **zero runtime logic**. Implement the actual behavior now, following the exact conditional logic already specified in `LOGIC-TREES-GLOBAL.md` and `GAP-ANALYSIS-V2.md`.

### 13.1 — Filter Engine (currently: schema only, never evaluated)
- [ ] On every new message arrival (inbound to an Account Mode mailbox), implement the real execution described in G13/L3:
  - Load the account's filters ordered by `priority_order`
  - Evaluate each filter's `conditions` (From/To/Subject-contains/Has-attachment/Size) against the real message
  - Apply matching `actions` (label/archive/mark-read/forward/delete) for real
  - Respect the **conflict resolution rules**: Forward actions always execute before a later Delete halts processing; Delete halts further evaluation after any pending Forward completes; multiple label-apply actions from different matching filters are all additive
- [ ] Verify by creating 2 real filters with overlapping conditions on a real test account, sending a real test message through the mail-service, and confirming via direct database query that the correct labels/archive state were actually applied in the correct order

### 13.2 — Retention Sweep (currently: `retentionDays` stored, never enforced)
- [ ] Implement a real scheduled sweep job (same cleanup-worker pattern as the existing Temp Mode expiration sweep) that:
  - Scans messages against their label(s)' `retention_days`
  - Applies the **longest-retention-wins** rule when a message has multiple labels with different policies
  - Applies the **Starred-overrides-everything** exception (never delete a starred message regardless of label policy)
  - Respects any active filter's "never delete" exception
  - Actually deletes the message and its attachments from the database and object storage when the retention period is exceeded
- [ ] Verify by creating a test message, setting its label's retention to a very short window (e.g., 1 minute, via a test-only config override — not a hardcoded shortcut left in production), waiting for the sweep to run, and confirming the message is genuinely gone from both DB and storage — then repeat with a Starred message and confirm it survives

### 13.3 — Vacation Auto-Reply (currently: settings API only, nothing ever sends anything)
- [ ] On real inbound message arrival to an account with vacation responder enabled, implement the actual sending logic per the loop-prevention rules already specified:
  - Check `repliedTo` tracking — do not reply twice to the same sender within the active vacation period
  - Respect "send only to contacts" setting by querying real Contacts
  - Skip known no-reply/bulk-sender patterns and messages with bulk headers
  - Actually send the configured auto-reply via the real outbound relay (Resend/Brevo) and record the fact in `repliedTo`
- [ ] Verify with two real test scenarios: (a) send 2 messages from the same test sender, confirm only 1 auto-reply is sent, recorded correctly; (b) send from a `noreply@`-pattern address, confirm no auto-reply is triggered

### 13.4 — Mail Tracking: Sent/Delivered/Bounced/Seen (currently: zero rows ever created)
- [ ] On every real outbound send, create a real `sent_messages` row and capture the real `relay_message_id` returned by the actual relay provider API call
- [ ] Implement a real webhook receiver endpoint that the relay provider (Resend/Brevo) calls on delivery/bounce/complaint events, and update `sent_messages.status` from that real webhook payload — not a simulated status transition
- [ ] Implement the tracking pixel endpoint for opt-in "Seen" tracking, and ensure the UI displays the honest "approximate, based on image loading" disclaimer exactly as specified in `GAP-ANALYSIS-V2.md §T2` — this disclaimer text must actually be present in the rendered UI, not just in documentation
- [ ] Implement the MDN read-receipt request/response flow, including the explicit "may not work with Gmail" UI disclaimer when the feature is used
- [ ] Verify by sending one real test email through the configured relay provider's sandbox/test mode (if available) or a real test inbox, and confirming the `sent_messages` row transitions through real states as real webhook events arrive — do not fabricate a webhook call to fake this

**If the relay provider (Resend/Brevo) account/API key is not available in this environment:** explicitly state this limitation, implement the full webhook-receiving and status-update logic so it is genuinely ready to work the moment real credentials are provided, and clearly flag in your report exactly what a human must configure (account signup, API key, webhook URL registration) to complete real-world verification.

---

## PHASE 14 — Full Regression Re-Verification

After Phases 12–13, you may have touched shared code (schema, auth, mail-service). Re-run the **entire verification suite from your prior audit** to confirm nothing broke:

- [ ] `bun run lint` → confirm still 0 errors
- [ ] `npx tsc --noEmit` → confirm still 0 production errors
- [ ] Re-run the full E2E curl test suite from `FINAL-AUDIT-SUMMARY-V2.md` (auth/me, domains, create inbox, receive-mail, get messages, IDOR, secure cookie) → confirm all still pass
- [ ] Re-run security header checks → confirm still 8/8 present
- [ ] Run new E2E tests for every Phase 12/13 addition (Account signup→profile→inbox flow, filter execution, retention deletion, vacation auto-reply, sent-message tracking)
- [ ] Re-check for any new forbidden tokens introduced during this sprint (`TODO`, `console.log`, `mock`, `placeholder`)

**Output:** `docs/audit/PHASE-14-REGRESSION-REPORT.md`

---

## PHASE 15 — Deployment-Ready Package (For the Remaining Human-Only Blockers)

You cannot execute these yourself (no root, no real domain, no VPS in this environment) — but you must produce **fully prepared, tested-as-much-as-possible, copy-paste-ready artifacts** so the human step is mechanical, not exploratory.

### 15.1 — TLS / Caddy
- [ ] Produce a final, parameterized `Caddyfile` template with a clear placeholder for the real domain (e.g., `{{DOMAIN}}`) replacing any `tls internal` sandbox setting, configured for automatic Let's Encrypt cert issuance
- [ ] Produce exact deployment commands (copy the Caddyfile to the server, reload Caddy, verify with `curl -I https://{{DOMAIN}}`)

### 15.2 — Inbound Mail (Postfix + MX)
- [ ] Produce the exact Postfix configuration needed to accept mail on port 25 and relay to the mail-service's internal port, including the `RCPT TO` validation hook design already locked in prior architecture decisions (reject unknown/expired recipients at SMTP level, no backscatter)
- [ ] Produce the exact DNS records required (MX, SPF, DKIM, DMARC, PTR) as a copy-paste-ready table with placeholder values clearly marked for the real domain/IP
- [ ] Produce a step-by-step verification script/checklist: how to confirm from a real Gmail account that a test email actually arrives, once deployed

### 15.3 — Git History Cleanup (VAPID keys)
- [ ] Re-confirm and re-provide the exact, tested `git filter-repo` command sequence (from your prior audit) plus the force-push command, plus post-cleanup instructions for any collaborators (re-clone required)
- [ ] Confirm `.env` is correctly excluded going forward and `.env.example` is accurate and secret-free

### 15.4 — Fresh VAPID Keys + Secret Rotation Checklist
- [ ] Provide the exact command to generate new production VAPID keys
- [ ] Produce a complete "secrets to rotate before going live" checklist covering every secret in `.env.example` (database credentials, session signing secret, relay provider API key, VAPID keys, admin credentials) — confirm none of the current sandbox values should ever be reused in production

### 15.5 — CI/CD + Monitoring Setup Instructions
- [ ] Produce the actual `.github/workflows/*.yml` CI pipeline files (lint, typecheck, test, build) ready to commit — this part you CAN do yourself, it doesn't require external accounts, only the final "connect to GitHub" step needs the human
- [ ] Produce a short setup guide for connecting Sentry, Uptime Robot, Google Search Console, and Google Postmaster Tools (free-tier signup steps + where to paste the resulting keys into `.env`)

**Output:** `docs/deploy/DEPLOYMENT-RUNBOOK.md` — a single, sequential, copy-paste-ready document a human can follow start to finish to go from "code is done" to "live in production," with every command, config file, and DNS record needed, and explicit checkboxes for the human to tick off.

---

## 2. REPORTING FORMAT (same as before)

```
## PHASE [N] REPORT: [Phase Name]
### Issues Found
### Fixes Applied
### Verification Performed
### Remaining/Deferred Items
### Confidence Level
```

## 3. FINAL DELIVERABLE

After Phase 15, produce an updated `docs/audit/FINAL-AUDIT-SUMMARY-V3.md` that:
- Confirms which of the original 6 NO-GO blockers are now **fully closed** (Account Mode UI, all 4 feature gaps, VAPID commands prepared)
- Confirms which blockers remain **explicitly human-only** (real domain purchase, real VPS root access, actual DNS propagation, actual force-push execution) — and points directly to `docs/deploy/DEPLOYMENT-RUNBOOK.md` for those
- Gives a final, honest statement: **"Code is 100% deployment-ready. Remaining work is infrastructure/domain/DNS execution by a human, fully documented in DEPLOYMENT-RUNBOOK.md."** — do not say this unless it's genuinely true based on your own verification.

Begin with Phase 12 now.

```
═══════════════════════════════════════════════════════════════════
END OF COMPLETION SPRINT PROMPT
═══════════════════════════════════════════════════════════════════
```
```

---

## What You Should Do While the Agent Works Through This

While Phases 12–15 run (this is a large sprint — expect it to take a while and possibly need to be split across multiple sessions if the sandbox has memory constraints like before):

1. **In parallel, actually buy your domain and provision your VPS** — no reason to wait for the code sprint to finish before doing this, since Phase 15's runbook will need real values (your actual domain name, your actual server IP) substituted in anyway.
2. **Check in after Phase 13 specifically** — that's the highest-risk phase (real mail-tracking webhooks, real filter/retention logic touching shared schema). Don't wait until Phase 15 to review; spot-check Phase 13's verification evidence as soon as it's reported.
3. **When `DEPLOYMENT-RUNBOOK.md` is produced, that becomes your personal execution checklist** — at that point the agent's job is done, and the remaining "Minimum action for GO" steps you listed become literal copy-paste steps you run yourself on your real server.
