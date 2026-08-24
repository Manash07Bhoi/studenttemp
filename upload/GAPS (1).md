# 📄 FILE: `GAP-ANALYSIS.md` — Self-Audit of the StudentTemp Documentation Suite

I re-reviewed `PRD.md`, `AGENT.md`, `SCREENS.md`, `DESIGN-SYSTEM.md`, `DATABASE.md`, `SECURITY.md`, `WORKFLOWS.md`, `CI-CD.md`, and `SOP.md` end-to-end as if preparing them for an actual engineering kickoff. Below are the **real gaps, contradictions, and under-specified areas** found, grouped by severity and domain, each with a concrete recommended fix. This file should be merged into the doc set before development starts.

---

## 🔴 CRITICAL — Will block correct implementation or cause real production risk

### C1. Inbound SMTP architecture is not actually decided (contradiction)
`CI-CD.md` lists **two mutually exclusive options** ("Cloudflare Email Routing → Worker" **OR** "self-hosted Postfix on Oracle VM") without picking one. This is not a stylistic gap — it's a **blocking architectural decision** because:
- Cloudflare Email Routing is a **forward-only** relay product. It does not give raw SMTP-level control (custom RCPT TO validation before accept, streaming large attachments, connection-level rate limiting, custom bounce behavior) that a temp-mail product needs.
- It also has per-account limits on number of destination addresses/rules that don't scale to "unlimited random inboxes."

**Fix (decision to lock in):**
> **Primary:** Self-hosted **Postfix + a custom milter/LMTP handoff** on the Oracle Cloud Always-Free VM, with Postfix configured to validate `RCPT TO` against a live lookup (recipient must exist in `inboxes` and be `active`) before accepting the DATA phase — this is what actually gives free, real-time reject-at-SMTP-level behavior.
> **Cloudflare's role is reduced to:** DNS hosting, MX record pointing at the Oracle VM's IP, WAF/edge protection for the *web* traffic only — **not** as the mail path.
> Add an ADR (`/docs/architecture/adr/0001-inbound-smtp.md`) documenting this decision so it isn't re-litigated by the coding agent.

### C2. No RCPT-TO backscatter/bounce policy defined
Workflow says "rejects unknown recipients early" but doesn't define what happens on **valid-looking but expired** addresses, or how bounces are generated for oversized/rejected mail without becoming a backscatter spam vector.

**Fix:** Add explicit rule: reject at `RCPT TO` stage with a permanent SMTP 550 error (not an accept-then-bounce pattern) whenever the address is unknown/expired/over quota. Never generate a DSN (bounce) to the `MAIL FROM` address — permanent rejection at the SMTP conversation level is the only backscatter-safe pattern. Document this explicitly in `WORKFLOWS.md`.

### C3. No API specification document exists
`PRD.md §38` shows 5 example endpoints. There is no full **OpenAPI/REST contract** covering: custom alias check/reserve, QR generation, notification subscribe/unsubscribe, session recovery, message delete, attachment download, admin endpoints, search, report-abuse.

**Fix:** Add `API-SPEC.yaml` (OpenAPI 3.1) as a required deliverable **before** frontend/backend split work begins, since both TypeScript FE and Go mail-core need a shared contract. This is Critical because without it, the AI agent will invent inconsistent endpoint shapes across features.

### C4. Session/auth transport mechanism unspecified
We say a "session token" is issued and "hashed copy stored server-side," but never specify:
- Is it sent as an `HttpOnly` cookie or an `Authorization: Bearer` header stored in IndexedDB?
- If cookie-based → CSRF protection is mandatory (currently only listed as generic bullet in §21, not wired to this specific flow).
- If header/localStorage-based → XSS becomes a full session-takeover vector (higher stakes given HTML-email rendering is in-app).

**Fix (decision to lock in):**
> Use a **`HttpOnly`, `Secure`, `SameSite=Strict` cookie** scoped to the API subdomain for the session token, **not** localStorage — this removes the token from JS-reachable storage entirely, which meaningfully reduces XSS blast radius given this app renders untrusted email content. CSRF double-submit token required on all state-changing POST/DELETE requests. The recovery "session code" shown to the user (`ST-7X9K-2Q4M`) is a **separate, user-facing recovery credential** used only to re-mint a cookie session on a new device — it is not the cookie itself.

### C5. Malware scanning tool never named — breaks "100% free" and "no fake scanning" promises simultaneously
`AGENT.md` forbids fake malware-scan results, but no doc names an actual scanner, so the agent has nothing real to integrate against, creating pressure to fake it.

**Fix:** Name **ClamAV** (open-source, free, self-hostable on the same Oracle VM or a small sidecar container) as the mandated scanner for MVP. Document scan pipeline explicitly: file → temp quarantine directory → `clamd` scan via socket → result → move to permanent object storage only if clean. This closes both the cost gap and the "don't fake it" mandate simultaneously.

### C6. CAPTCHA/challenge vendor never named
"CAPTCHA/challenge escalation" is referenced repeatedly but no concrete, privacy-respecting, free vendor chosen — leaves ambiguity that could result in Google reCAPTCHA (which conflicts with the privacy positioning by sending data to Google).

**Fix:** Name **Cloudflare Turnstile** (free, privacy-preserving, no tracking cookies) as the mandated challenge provider.

---

## 🟠 HIGH — Missing pieces that will surface as real bugs/incidents post-launch

### H1. No entropy/algorithm spec for `public_id` and address local-part generation
"Cryptographically secure randomness" is asserted but never quantified.

**Fix:** Specify explicitly: local-part = `student-` + 10 characters from a 32-symbol unambiguous alphabet (no `0/O/1/l` confusion) generated via a CSPRNG (`crypto.randomBytes`/Go `crypto/rand`) = ~50 bits of entropy, sufficient against practical enumeration at expected traffic volumes. `public_id` (inbox/message external IDs) = 21-character nanoid (~126 bits entropy). Add this table to `DATABASE.md`.

### H2. Race condition handling for custom alias claims described narratively but not mechanically
"Transaction with row lock" is mentioned once but the actual mechanism (`SELECT ... FOR UPDATE` vs a unique-constraint-and-catch-conflict pattern vs Redis `SETNX` lock) is undefined.

**Fix:** Specify: use a **Redis `SET key NX PX <ttl>`** as a fast distributed lock during the reservation window (cheaper than DB row locks under contention), then a Postgres unique constraint as the final authoritative guard — if the DB insert fails on conflict despite holding the Redis lock (clock skew edge case), return a clean "just taken" error rather than a 500.

### H3. Reconnection/backoff logic for SSE not defined
No spec for: reconnect interval, exponential backoff ceiling, max retry count before falling back to polling, or how "missed events while disconnected" are reconciled (client must re-fetch full message list on reconnect, not assume delta continuity).

**Fix:** Add to `WORKFLOWS.md`: on SSE disconnect, client retries with exponential backoff (1s→2s→4s→8s→cap 30s), and **on every successful reconnect, re-fetches the full message list** (not just resumes streaming) to guarantee consistency — SSE is a "wake-up" signal, not the source of truth.

### H4. Multi-tab synchronization not addressed
If a user opens the same inbox in two tabs, read/unread state and deletions can desync.

**Fix:** Use the `BroadcastChannel` API (or `localStorage` storage-event fallback) to sync read-state and deletion actions across tabs of the same origin instantly, without extra server round-trips.

### H5. Homograph / display-name spoofing not covered in message reader threat model
A malicious sender can set display name to `PayPal Support` or use punycode domains (`xn--paypal-...`) to visually spoof identity — this is a very common real attack vector for a product literally designed to receive registration/verification mail.

**Fix:** Add to `SECURITY.md` threat model as **T11 — Sender Spoofing/Homograph Attack**: render punycode domains in their decoded + raw form side-by-side with a warning icon when they don't match ASCII expectations; never trust `Display Name` alone in the message list UI — always show the raw address adjacent to it in a lower-emphasis but always-visible style.

### H6. No concrete default quotas — deferred entirely to "load testing," but MVP needs launch-day numbers
Leaving every quota as "TBD via load testing" is not implementable literally as day-1 config.

**Fix — ship these as tunable config defaults (adjustable via feature flags, not hardcoded):**
| Quota | Default |
|---|---|
| Max active inboxes/session | 5 |
| Max message size | 10 MB |
| Max attachment size | 5 MB per file, 15 MB total/message |
| Max messages/inbox | 100 (oldest auto-pruned beyond this) |
| Inbox creation rate | 10/hour/IP, 30/day/IP |
| Custom alias availability checks | 20/minute/IP before Turnstile challenge |
| SSE connections | 3 concurrent/IP |

### H7. Free-tier capacity ceilings never validated against the "100% free" claim
Upstash free Redis (10k commands/day on some plans), Neon/Supabase free storage caps (~0.5GB–3GB), R2 free 10GB — none of these are checked against realistic MVP traffic, so the "100% free to build" promise is unverified.

**Fix:** Add an explicit **capacity ceiling table** to `CI-CD.md` per provider's free-tier limits, plus a documented "free-tier exhaustion alert" (Grafana/UptimeRobot threshold) so the team knows exactly when the product must graduate to paid tiers — framed as a planned graduation point, not a surprise outage.

### H8. Search feature has no implementation technology chosen
`PRD.md §34` lists search query syntax but no engine.

**Fix:** Use **PostgreSQL full-text search** (`tsvector`/`GIN` index on subject+sender) for MVP — no extra infra cost, "good enough" at temp-mail message volumes per inbox. Explicitly rule out Elasticsearch/Meilisearch for MVP to avoid infra bloat, revisit only if Phase 3 API usage demands it.

### H9. Legal/compliance gap: India's DPDP Act 2023 not addressed despite India-focused product
Given the explicit Indian-student positioning, the **Digital Personal Data Protection Act (DPDP), 2023** has real requirements: consent notices, data principal rights (access/erasure requests), breach notification timelines, and special treatment of minors' data (many students are under 18).

**Fix:** Add to `PRD.md §47 Legal Pages`:
- A **DPDP-compliant consent/notice banner** on first visit (distinct from a generic cookie banner).
- A documented **Data Principal Request** flow (even if manual/support-email-based at MVP) for access/erasure requests.
- An explicit **age-related policy statement**: since no real identity is collected, formal parental consent isn't triggered under the "no personal data" minimization strategy — but this legal position must be reviewed by actual counsel before launch, not assumed. Flag this in `OPEN-QUESTIONS.md`.
- A breach-notification runbook stub with defined severity thresholds and timelines.

### H10. Incident Response runbook is referenced as a checklist item but never actually written
`SOP.md` says "Incident response runbook exists" as a go/no-go gate, but no runbook is provided anywhere in the suite — this is circular.

**Fix:** Add a real `INCIDENT-RESPONSE.md` with: severity levels (SEV1–4 definitions), on-call escalation path, communication templates (status page update, user-facing notice), post-incident review template, and specific playbooks for the two most likely incidents for this product: (a) a domain gets spam-blacklisted, (b) a sanitizer bypass is discovered in the wild.

---

## 🟡 MEDIUM — Real gaps, lower immediate risk

### M1. "Indian school email" original request under-resolved
The user asked twice, with emphasis, for "Indian school email." My response correctly refused to forge real `.ac.in`/`.edu.in` domains — that boundary is right and must stay — but I only partially gave a legitimate alternative. This should be made explicit as a **resolved product decision**, not just a boundary statement:

**Fix — add to `PRD.md §69 Future Student Features` as a named Phase 3 feature:**
> **"Verified Institution Partner Program"** — a genuinely separate, opt-in system where an actual Indian school/college **legitimately owns and operates its own subdomain** (e.g., `student.actualcollege.ac.in` configured by the institution's own IT admin, with StudentTemp merely providing the underlying temp-mail *infrastructure* under that institution's real, DNS-verified domain). This is the only legitimate path to "Indian school email," requires DNS ownership verification (TXT record challenge) before any such domain goes live, and is contractually/legally separate from the anonymous public product.

### M2. No visual wireframes (ASCII or otherwise) per screen
`SCREENS.md` is thorough in prose but has no layout sketches, unlike the architecture diagrams elsewhere in the suite — inconsistent level of visual specification.

**Fix:** Add simple ASCII-box wireframes for the 5 highest-traffic screens (Home, Message Reader, Customize sheet, Settings, Expired) to `SCREENS.md` so frontend implementation isn't guessing spatial layout from prose alone.

### M3. Empty/error/loading states not enumerated for every screen
Screens 9 (My Addresses), 14 (Admin), and search results are missing explicit empty/error/loading state text, breaking the "every screen needs 3 states" rule set in `AGENT.md §5`.

**Fix:** Add a states table (Empty / Loading / Error copy) for every screen in `SCREENS.md`, not just the primary ones — this should be a literal checklist item per screen, not prose-only.

### M4. Data export / portability feature mentioned as "secondary goal" but never designed
No screen, no endpoint, no format (JSON/EML) defined for "inbox export."

**Fix:** Add explicit spec: export as a `.zip` containing `.eml` files per message (standard, portable format), available only while the inbox is still active, generated on-demand (never pre-generated/stored), download link expires in 5 minutes.

### M5. "Burn after reading" / single-use inbox mode absent
A very natural student use case (one-time OTP grab) is missing as an explicit mode.

**Fix:** Add as a Phase 2 feature: inbox creation option "Delete after first message" — auto-expires the inbox 60 seconds after the first message is marked read.

### M6. RTL layout not addressed despite Arabic listed as a future language
**Fix:** Add explicit RTL logical-property requirement (`margin-inline`, `padding-inline`, not `left/right`) to `DESIGN-SYSTEM.md` so this isn't a rewrite later.

### M7. Analytics tool never named — risk of defaulting to Google Analytics, which contradicts privacy positioning
**Fix:** Name **Umami or Plausible (self-hosted, free/open-source)** explicitly in `PRD.md §61` as the mandated analytics tool — no third-party trackers, no cross-site cookies.

### M8. Report Abuse flow referenced in nav but never specified end-to-end
**Fix:** Add a screen + endpoint spec: reporting a message flags it for admin review queue (Screen 14 extension), captures message ID + reason category, does **not** notify the sender, and is rate-limited to prevent report-flooding abuse of the abuse system itself.

### M9. Contact/Support flow missing despite being a required legal page
**Fix:** Add a simple static contact form (email-based ticket, no live chat needed for MVP) with abuse-resistant rate limiting and a honeypot field (no CAPTCHA needed for such a low-value target).

### M10. Migration tooling for Postgres/Go never named
**Fix:** Name **`golang-migrate`** (or Prisma Migrate if the BFF owns schema ownership) explicitly as the migration tool, version-controlled under `/infrastructure/migrations`.

---

## 🟢 LOW — Polish-level gaps

- **App icon deliverable sizes** not enumerated: add explicit export list (16/32/48/180/192/512px PNG, maskable variant, SVG source, `favicon.ico`, Apple splash screens per device size) to `DESIGN-SYSTEM.md`.
- **Timezone handling** for timestamps not specified — fix: store all timestamps UTC, render in user's local timezone client-side, never rely on server-rendered localized time.
- **Reduced clipboard-permission fallback** not specified — fix: if `navigator.clipboard.writeText` fails/unavailable, fall back to a selected, read-only text field with "select all" affordance.
- **Local dev SMTP tool** not named — fix: mandate **Mailpit** or **MailHog** for local development inbound-mail testing, explicitly documented as dev-only tooling confined to `/tests/fixtures`, never reachable from staging/production code paths (this directly satisfies `AGENT.md`'s "no fake logic in production paths" rule while giving developers something real to test against).
- **Admin session security** doesn't specify MFA method — fix: TOTP (e.g., via free `otplib`), not SMS (cost + SIM-swap risk).

---

## 📋 Consolidated Action List (Docs to Add/Update Before Development Starts)

| New/Updated File | Purpose |
|---|---|
| `docs/architecture/adr/0001-inbound-smtp.md` | Lock in Postfix-on-Oracle-VM decision (closes C1) |
| `API-SPEC.yaml` (OpenAPI 3.1) | Full contract for FE/BE (closes C3) |
| `INCIDENT-RESPONSE.md` | Real runbook, not just a checklist reference (closes H10) |
| `docs/decisions/OPEN-QUESTIONS.md` | Track DPDP/minors legal review, institution-partner legal terms |
| Update `SECURITY.md` | Add T8–T11 threats, session cookie decision, ClamAV + Turnstile naming |
| Update `DATABASE.md` | Add entropy spec table, migration tool name, export feature fields |
| Update `WORKFLOWS.md` | Add SSE reconnect logic, multi-tab sync, RCPT-TO bounce policy |
| Update `SCREENS.md` | Add wireframes, full 3-state tables per screen, Report Abuse + Export screens |
| Update `PRD.md` | Add Verified Institution Partner Program (Phase 3), Burn-after-reading mode, quota defaults table |
| Update `CI-CD.md` | Add free-tier capacity ceiling table, name Umami/Plausible |

This gap analysis should be treated as **blocking for Phase 0 sign-off** — particularly items C1–C6, which are architecture-defining decisions the coding agent cannot safely infer on its own.
