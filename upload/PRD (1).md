# StudentTemp — Complete Project Documentation Suite

**Version:** 1.0 · **Status:** Production Specification · **Date:** August 2026
**Stack Decision:** TypeScript everywhere (Frontend + BFF), Go (mail/security core), PostgreSQL, Redis — **100% free-tier buildable**

This suite contains multiple linked documents. Each is marked as a separate file so it can be dropped directly into a repo `/docs` folder.

---

# 📄 FILE: `PRD.md`

## 1. Product Summary

StudentTemp is a privacy-first temporary email platform built for students, developers, testers, and privacy-conscious users. It issues short-lived, disposable inboxes with **real SMTP receiving**, sanitized HTML rendering, automatic expiration, and a mobile-first PWA experience. It never impersonates real institutional (`.edu`, `.ac.in`) identity.

**Core Loop:** `Open → Generate/Customize → Copy → Receive → Read → Expire/Delete`

## 2. Goals / Non-Goals

Same as baseline spec (see canonical list). Key reinforced rule:

> ❌ Never issue, forge, or imply real university/school (`.edu`, `.ac.in`, `.edu.in`) addresses.
> ✅ May offer **operator-owned, India-themed domains** (e.g. `@studentbox.in`, `@campusmail.in`) purely as branding — clearly labeled "temporary, not an official institution address."

## 3. Headline New Features (this revision)

### 3.1 Custom Email Alias (Customization Engine)
- User can request a **custom local-part** instead of a random one: `rahul.dev@studentbox.in`
- Availability check in real time (debounced, rate-limited)
- Rules: 3–30 chars, `a–z 0–9 . _ -`, no leading/trailing symbol, no reserved words (`admin`, `support`, `postmaster`, `abuse`, `security`, `noreply`, `webmaster`), profanity/slur filter, no impersonation patterns (`paypal-support`, `bank-verify`, etc.)
- Custom aliases still **expire** like random ones (customization ≠ permanence)
- Anti-squatting: same custom alias cannot be re-claimed by a different anonymous session for a cooldown window after expiry (prevents targeted hijack of "waited-for" addresses)

### 3.2 "Indian Student" Themed Domain Pack
- Curated, operator-owned `.in`/`.co.in` style domains with student-friendly branding: `@studentbox.in`, `@campusmail.in`, `@examprep.in`
- Regional language UI (Hindi, Odia, Telugu, Tamil, Bengali, Marathi)
- Category presets tuned to Indian student use cases: *Exam Portal Registration*, *Scholarship Portal*, *Coaching App OTP*, *College Fest Signup*, *Internship Portal*
- Persistent, prominent disclaimer banner: *"This is a private temporary address, not an official school/college/university email."*
- No claim of `.edu.in`/`.ac.in` affiliation anywhere in UI, marketing, or metadata.

### 3.3 Multi-Address Management ("My Addresses" Tray)
- Up to N (policy-defined, e.g., 5 for free/anonymous session) concurrently active inboxes per session token
- Quick switcher (bottom sheet on mobile, sidebar on desktop)

## 4. Personas
Student · Developer · QA Tester · Researcher · Educator · Privacy User (unchanged from baseline — see Section 4 of original brief).

## 5. Full Feature Matrix

| Category | MVP | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Random inbox generation | ✅ | | | |
| Custom alias | | ✅ | | |
| Indian domain pack | | ✅ | | |
| Real-time inbox (SSE/WS) | | ✅ | | |
| QR sharing | | ✅ | | |
| Multi-inbox tray | | ✅ | | |
| PWA installable | | ✅ | | |
| Browser push notification | | ✅ | | |
| Dev API + webhooks | | | ✅ | |
| Multi-domain admin | | | ✅ | |
| Org/team accounts | | | ✅ | |
| Sandbox/test-mode inboxes | | | | ✅ |
| Email render compatibility tester | | | | ✅ |

## 6. Monetization (non-intrusive)
Free tier fully usable without payment; Pro/Developer tiers unlock retention length, quotas, and API — **never** unlocks unsafe long-term storage of sensitive content by default (opt-in with explicit warning).

## 7. Success Metrics
North Star: **Successfully delivered temporary inbox sessions.**
Supporting: activation rate, delivery success rate, message latency (SMTP-accept → UI render), abuse rate (%), custom-alias claim success rate, Indian-domain adoption rate.

## 8. MVP Definition of Done
See `SOP.md §PreRelease Checklist`. MVP ships **only**: random inbox generation, real SMTP receive, inbox+reader, expiration+cleanup, HTML sanitization, rate limiting/abuse basics, legal pages, responsive UI, basic monitoring. Customization + Indian domain pack ship in Phase 2 once abuse tooling is proven stable.

---

# 📄 FILE: `AGENT.md` (Instructions for AI Coding Agent)

## Purpose
This file governs any AI agent (Copilot/agentic coder) contributing code to this repository. It is a **binding contract**, not a suggestion.

## 1. Absolute Prohibitions
The agent **must never**:
- Insert mock, placeholder, dummy, or fake data into any file that ships to staging/production.
- Write `// TODO`, `// FIXME`, `// placeholder`, `console.log` debug leftovers, or stub functions that silently "pretend" to work.
- Simulate SMTP, fake "message received" events, or hardcode sample inbox content.
- Fabricate malware-scan results, SPF/DKIM/DMARC results, or analytics numbers.
- Hardcode secrets, API keys, DB passwords, or JWT signing keys in source.
- Generate fake `.edu`/`.ac.in`/institutional domains or claim official student-identity status anywhere in copy, metadata, or code comments.
- Disable security checks "temporarily" without an explicit, tracked, expiring ticket.
- Ship a feature without: input validation, error state, loading state, empty state, and a test.

If a real dependency (SMTP server, malware scanner, object storage) is not yet available in the dev environment, the agent must build against a **clearly isolated, explicitly labeled local test harness** inside `/tests/fixtures`, never inside `/apps` or `/services` production code paths, and must leave a real integration point (interface/contract) ready to wire up — not a fake success return baked into business logic.

## 2. Engineering Priorities (in order)
1. Correctness of mail-receiving pipeline
2. Security (sanitization, isolation, auth, rate limiting)
3. Data lifecycle correctness (expiration really deletes data)
4. Reliability/observability
5. UX polish
6. Visual design

## 3. Tech Stack Contract

| Layer | Technology | Reason |
|---|---|---|
| Frontend | TypeScript, React, Vite, PWA | Free hosting compatible, fast DX |
| BFF / Public API | TypeScript (Node, Fastify or Hono) | Shares types with frontend, fast to iterate |
| Mail Gateway & Security Core | Go | High concurrency SMTP handling, strong stdlib crypto/net |
| Database | PostgreSQL (Neon/Supabase free tier) | Relational integrity, TTL-friendly, JSONB for metadata |
| Cache/Queue | Redis (Upstash free tier) | Rate limiting, pub/sub for real-time push, TTL keys |
| Object Storage | Cloudflare R2 free tier / Supabase Storage | Attachment blobs |
| Real-time transport | SSE (primary), WebSocket (fallback upgrade later) | Simpler infra, unidirectional fits use case |
| Reverse Proxy / Edge | Cloudflare (free plan) | WAF, CDN, DDoS protection, free TLS |
| Inbound Email | Cloudflare Email Routing → Worker → API webhook, OR self-hosted Postfix on Oracle Cloud Always-Free VM | Zero-cost inbound SMTP path |
| CI/CD | GitHub Actions (free minutes for public/small private repos) | No cost |
| Hosting (frontend) | Cloudflare Pages / Vercel free tier | Free, fast global CDN |
| Hosting (API/Go services) | Fly.io free allowance or Oracle Cloud Free Tier VM | Free compute |

**Rule:** Do not introduce Kubernetes, Kafka, microservice sprawl, or additional languages unless a measurable requirement (documented in an ADR under `/docs/architecture/adr/`) justifies it.

## 4. Coding Standards
- Strict TypeScript (`strict: true`, no `any` without justification comment + lint-suppression review).
- Go: `golangci-lint` clean, context-aware cancellation on all I/O, no goroutine leaks.
- All public functions documented (purpose, inputs, outputs, error modes).
- All user input validated at the boundary (API layer) using schema validation (e.g., Zod) — never trust client.
- All DB access via parameterized queries only — never string-concatenated SQL.
- All secrets read from environment/secret manager, never committed. `.env.example` only, never `.env`.

## 5. Definition of Done per Task
A task is complete only when:
- [ ] Feature works against real dependency or a clearly labeled test double confined to `/tests`
- [ ] Unit tests written and passing
- [ ] Integration test covers the happy path + at least 2 failure paths
- [ ] Loading, empty, and error UI states implemented (frontend tasks)
- [ ] Accessibility pass (labels, focus order, contrast)
- [ ] Security review checklist (§ below) passed
- [ ] Logged in changelog / PR description with rationale
- [ ] No lint/type errors, CI green

## 6. Security Review Checklist (attach to every PR touching input/output paths)
- [ ] Is all input validated & length-limited?
- [ ] Is all output encoded/escaped for its context (HTML/JSON/URL)?
- [ ] Are rate limits applied to any new endpoint?
- [ ] Does this endpoint leak internal IDs, stack traces, or secrets on error?
- [ ] Does this change touch the HTML sanitizer? If yes, has it been tested against known XSS payload corpus?
- [ ] Does this change affect data retention/deletion? If yes, is the lifecycle documented and tested?

## 7. Branching & Release Model
`main` (protected, deploy-only-via-CI) ← `release/*` ← `feature/*` / `fix/*`. Conventional commits. Semantic versioning for API (`/api/v1`, `/api/v2`).

## 8. Communication / Ambiguity Handling
When requirements are ambiguous, the agent must **not guess silently** — it must open a `/docs/decisions/OPEN-QUESTIONS.md` entry describing the ambiguity, the options, and a recommended default, and proceed with the safest, most privacy-preserving default until resolved.

---

# 📄 FILE: `SCREENS.md` (Screen-by-Screen UI/UX)

## Navigation Model (Global)
- **Top App Bar:** 3-line hamburger (left) → opens Side Drawer · Logo/wordmark (center-left) · Address status pill (right) · Theme toggle (right)
- **Back Navigation:** Every non-root screen shows a left-chevron "back arrow" in the app bar; browser/hardware back gesture is intercepted to close modals/bottom-sheets before navigating history (prevents accidental inbox loss). On PWA/Android, back button closes sheets → then navigates back → then exits app (double-back-to-exit pattern with toast "Press back again to exit").
- **Side Drawer (Hamburger Menu) contents:** Home/Inbox · My Addresses · Create New Address · Settings · Security & Privacy Info · Dark Mode Toggle · Language · How It Works · FAQ · Privacy Policy · Terms · Report Abuse · About · (Developer API — Phase 3)
- **Bottom Navigation (mobile only, 4 tabs):** Inbox · Addresses · Create · Settings
- **Gestures:**
  - Swipe left on message row → reveal Delete
  - Swipe right on message row → reveal Mark read/unread
  - Pull-down on inbox list → manual refresh (with haptic tick on supported devices)
  - Long-press address pill → quick copy + haptic feedback
  - Swipe down from top of message reader → close reader (return to list)
  - Edge-swipe from left screen edge → native back gesture (iOS/Android)
  - Two-finger pinch on message reader (HTML view) → zoom (accessibility)
  - Swipe between "My Addresses" tabs → horizontal carousel switch

---

## Screen 1 — Splash / App Boot
**Purpose:** Cold start, session bootstrap.
**UI:** Centered logo mark, subtle pulse animation (respecting reduced-motion), version tag bottom.
**Logic:** Checks for existing anonymous session token in local storage → validates with backend → routes to Home (existing inbox) or Home (create new).
**Error State:** If backend unreachable → "Can't connect. Check your internet." + Retry button, cached shell shown (PWA offline shell).
**Timeout:** 5s max before falling back to offline shell.

## Screen 2 — Home / Active Inbox (Root Screen)
**Purpose:** Primary hero + inbox in one screen (single-page core experience).
**Sections (top→bottom):**
1. Hero card: current address (monospace, truncation-safe), Copy, QR, Share, Regenerate
2. Expiry chip with live countdown + color states (Normal=neutral, Warning ≤15min=amber, Critical ≤1min=red, Expired=gray)
3. Domain/Customize row: dropdown for domain pack (Standard / Indian Student Pack), "Customize address" pencil icon
4. Message list (see Screen 4)
**Empty State:** Illustration + "Waiting for incoming mail…" + subtle animated dot pulse + hint text "Keep this tab open — new mail appears automatically."
**Loading State:** Skeleton rows (3) mimicking message card shape; hero card shows skeleton for address if still generating.
**Error State:** "We couldn't create your inbox." + Retry + Diagnostics link (non-sensitive request ID shown).
**User Actions → System Response:**
- Tap Copy → clipboard write → toast "Copied" (2s) + subtle button pulse
- Tap Regenerate → confirmation sheet ("This will discard your current inbox and messages. Continue?") → Yes destroys old, generates new
- Tap QR → opens Screen 7
- Pull to refresh → forces manual poll fallback if SSE disconnected

## Screen 3 — Customize Address (Bottom Sheet / Modal)
**UI:** Text input (local-part) with live validation chip (✅ available / ❌ taken / ⚠️ invalid characters), domain selector (segmented control: Standard Pack / Indian Student Pack), preview line showing full resulting address, Confirm button (disabled until valid+available).
**Logic:** Debounced (400ms) availability check against server; server enforces reserved-word & profanity filters; rate-limited to prevent enumeration scraping of "taken" usernames.
**Error State:** Inline field error ("This address isn't available"), network error banner if check fails.
**Empty State:** N/A (always has default suggestion pre-filled, e.g., `student-<random>`).

## Screen 4 — Message List (embedded in Home, also full-screen on narrow devices when scrolled)
**Card layout:** Avatar (initials/monogram, deterministic color from sender domain hash) · Sender name/address · Subject (bold if unread) · relative time · attachment paperclip icon if present · security shield icon (green/gray/amber) · unread dot.
**States:** Empty (see Screen 2), Loading (skeletons), Error (banner "Couldn't load messages" + Retry), Populated (list, newest first).
**Gestures:** swipe-left delete w/ undo snackbar (5s); tap → opens Screen 5.

## Screen 5 — Message Reader
**UI:** App bar with Back arrow, Sender block (name, address, "Show details ▾" reveals full headers), Subject (large), Received timestamp, Security badge (tap → Screen 6), body content in **sandboxed iframe** (no top-level script execution, `sandbox` attribute, remote-content blocked by default with "Load external images (3)" banner), attachment chips at bottom (tap → Screen 8 preview or download), action bar (Delete, Mark unread, Report as abuse/phishing, Share message metadata).
**External link handling:** Tapping a link inside the sandboxed content triggers an interstitial: "You're leaving StudentTemp to visit example.com. Continue?" with domain shown clearly.
**Empty/Loading/Error:** Skeleton text blocks while fetching; error banner if message expired mid-read ("This message is no longer available.").

## Screen 6 — Message Security Panel (Bottom Sheet)
**Content:** SPF result, DKIM result, DMARC result, Authentication summary chip (Pass/Fail/None — neutral colors, not "Safe/Unsafe"), sender domain, Message-ID, received timestamp, plain-language disclaimer: *"Authentication checks confirm the sending server's identity — they do not guarantee the message content is safe."*

## Screen 7 — QR Share
**UI:** Large QR code centered, address printed below in monospace, Copy + Share buttons, "Scan to open this address on another device" caption.
**Logic:** QR encodes only the plain email address string — nothing else.

## Screen 8 — Attachment Preview
**UI:** File icon or safe preview (images only, after scan clears), filename, size, scan-status chip (Scanning… / Clean / Quarantined), Download button (disabled until scan clears).
**Error State:** "This file was flagged and cannot be downloaded." with Report link.
**Loading State:** "Scanning attachment for safety…" progress indicator.

## Screen 9 — My Addresses (Multi-Inbox Tray)
**UI:** List/carousel of active inboxes (address, expiry chip, unread badge), "+ New Address" card at end (disabled with tooltip if quota reached), swipe-to-delete per address.
**Empty State:** "You don't have any temporary addresses yet." + CTA.

## Screen 10 — Settings
**Sections:** Appearance (Light/Dark/System), Language, Notifications (toggle + granularity: "Show message preview in notification" default OFF), Privacy (Block remote content toggle, Clipboard behavior), Session (Session ID display + "Copy recovery code" + "End session/Clear all data"), About/Legal links, App Lock (see below), Danger Zone (Delete all my data now).

## Screen 11 — App Lock Setup / Unlock
See **App Lock Flow** in Workflows section below for logic. UI: PIN pad (4–6 digit) or biometric prompt (WebAuthn where supported), "Forgot PIN? Reset (clears local data only, does not affect server-side inbox expiry)".

## Screen 12 — Expired Inbox
**UI:** Illustration (hourglass/fade), "This temporary inbox has expired," Create New Address button, Return Home button. If policy allows a short "grace" restore window: "Restore for 5 more minutes" (rate-limited, one-time).

## Screen 13 — How It Works / FAQ / Legal (static content screens)
Standard content screen with back arrow, TOC sidebar on desktop, accordion on mobile.

## Screen 14 — Admin Dashboard (separate privileged app, `/admin`)
- Login (MFA required) → System Status board → Metrics → Domains management → Abuse events queue → Audit log viewer → Role management
Each with its own loading/empty/error states mirroring the same design system, but denser data-grid layout.

## Screen 15 — Onboarding (first-run only, skippable, 3 slides)
1. "Your inbox, disposable by design" 2. "Real email, sandboxed and safe" 3. "Customize it, make it yours" → CTA "Create my inbox"

---

# 📄 FILE: `DESIGN-SYSTEM.md`

## Brand & Logo Concept
- **Mark:** A rounded-square "envelope + hourglass" hybrid glyph — envelope flap forms the top of an hourglass silhouette, symbolizing "temporary mail." Single continuous stroke, works at 16px favicon size.
- **Wordmark:** "StudentTemp" in a modern geometric sans (e.g., Inter/Manrope), lowercase logotype for approachability: `studenttemp`.
- **Color system:**
  - Primary (Brand): Indigo `#4F46E5` (trust, tech)
  - Accent (Success/Received): Teal `#10B981`
  - Warning: Amber `#F59E0B`
  - Critical/Expired: Rose `#EF4444`
  - Neutral scale: Slate 50→900 for light/dark surfaces
- **Typography:** Inter (UI text), JetBrains Mono (email addresses, message IDs, technical data)
- **Elevation:** 3-tier shadow system (flat cards, raised sheet, floating modal) — subtle, no heavy skeuomorphism
- **Iconography:** Outline-style icon set (Lucide/Feather-class), 24px grid, 2px stroke, consistent corner radius (rounded)
- **Motion:** 150–250ms ease-out transitions, no bounce/elastic; respects `prefers-reduced-motion`
- **Dark Mode:** True neutral dark surfaces (`#0F172A` base, `#1E293B` elevated), accent colors desaturated slightly for contrast comfort
- **Grid:** 8pt spacing system; touch targets minimum 44×44px
- **Component Library:** Buttons (primary/secondary/ghost/destructive), Chips (status), Cards, Sheets (bottom-sheet on mobile, modal on desktop), Snackbars/Toasts, Skeletons, Empty-state illustrations (line-art style, brand-colored), Segmented controls, Countdown ring/chip

---

# 📄 FILE: `DATABASE.md` (PostgreSQL Schema)

## Entity Overview
`sessions` · `inboxes` · `custom_aliases` · `domains` · `messages` · `attachments` · `abuse_events` · `rate_limit_buckets` · `admin_users` · `admin_roles` · `audit_logs` · `notification_subscriptions` · `feature_flags`

### `sessions` (anonymous recovery session)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| public_token_hash | text unique | SHA-256 of the token shown to user (raw token never stored) |
| created_at | timestamptz | |
| last_seen_at | timestamptz | |
| expires_at | timestamptz | rolling TTL |
| max_inboxes | int | quota, default policy value |
| locale | text | |
| flags | jsonb | e.g., `{"appLockEnabled":false}` (client-declared, non-sensitive) |

### `domains`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| domain | text unique | e.g., `studentbox.in` |
| pack | enum('standard','indian_student') | UI grouping |
| mx_enabled | bool | |
| active | bool | kill-switch |
| reputation_score | int | internal 0–100 |
| created_at | timestamptz | |

### `inboxes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | internal only, never exposed |
| public_id | text unique, indexed | opaque external identifier (nanoid, 21+ chars) |
| session_id | uuid FK → sessions | nullable if fully anonymous single-use |
| local_part | text | validated charset |
| domain_id | uuid FK → domains | |
| is_custom_alias | bool | |
| status | enum('active','expiring','expired','deleted') | |
| created_at | timestamptz | |
| expires_at | timestamptz | indexed for cleanup sweep |
| last_activity_at | timestamptz | |
| message_count | int | denormalized counter |
| max_messages | int | quota |

**Constraint:** unique index on `(local_part, domain_id)` **where** `status = 'active'` (allows reuse after expiry+cooldown).

### `custom_aliases` (reservation/cooldown ledger — separate from inbox lifecycle to enforce anti-squatting)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| local_part | text | |
| domain_id | uuid FK | |
| last_used_by_session_hash | text | hashed, for cooldown enforcement only |
| cooldown_until | timestamptz | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | internal |
| public_id | text unique | opaque external ID |
| inbox_id | uuid FK → inboxes, indexed | |
| smtp_message_id | text | from `Message-ID` header |
| sender_address | text | |
| sender_display_name | text | |
| subject | text | |
| received_at | timestamptz indexed | |
| size_bytes | int | |
| has_html | bool | |
| has_text | bool | |
| has_attachment | bool | |
| spam_score | numeric | |
| auth_spf | enum('pass','fail','neutral','none','error') | |
| auth_dkim | enum(...) | |
| auth_dmarc | enum(...) | |
| sanitized_html_key | text | object storage pointer, not raw HTML in DB |
| raw_source_key | text | object storage pointer (optional, retention-limited) |
| is_read | bool | |
| expires_at | timestamptz indexed | inherited from inbox at insert time |

### `attachments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| message_id | uuid FK → messages | |
| filename | text | sanitized, original preserved separately if needed |
| mime_type | text | server-verified via magic bytes, not trusted from header |
| size_bytes | int | |
| storage_key | text | object storage path |
| sha256 | text indexed | dedupe + malware DB correlation |
| scan_status | enum('pending','clean','quarantined','failed') | |
| expires_at | timestamptz | |

### `abuse_events`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| hashed_ip | text indexed | HMAC-SHA256 with rotating secret, never raw IP long-term |
| event_type | text | `RATE_LIMIT_HIT`, `ENUM_ATTEMPT`, `MALWARE_ATTACHMENT`, etc. |
| severity | enum('low','medium','high','critical') | |
| metadata | jsonb | |
| created_at | timestamptz | |

### `rate_limit_buckets` (if not fully in Redis — Postgres backup for audit)
Standard leaky-bucket columns: `key`, `window_start`, `count`, `limit`.

### `admin_users`, `admin_roles`
Standard RBAC tables: `admin_users(id, email, password_hash, mfa_secret_encrypted, role_id, is_active)`, `admin_roles(id, name, permissions jsonb)`.

### `audit_logs`
`(id, actor_admin_id, action, target_type, target_id, metadata jsonb, ip_hash, created_at)` — append-only, no delete permission at app layer.

### `notification_subscriptions`
`(id, session_id, endpoint, keys jsonb, created_at, expires_at)` — Web Push subscription objects.

### `feature_flags`
`(key, enabled, rollout_percentage, metadata jsonb, updated_at)`

## Indexing & Cleanup Strategy
- Partial index on `inboxes(expires_at) WHERE status='active'` → cleanup sweep job scans this every 60s.
- Cleanup job: cascades delete messages → attachments (object storage delete first, DB row after confirmed) → search index removal → cache invalidation (`DEL inbox:{public_id}` in Redis).
- Nightly job purges `abuse_events` older than defined retention (e.g., 30 days) and `audit_logs` older than compliance-defined retention (e.g., 1 year, append-only archive first).

## Redis Key Design
```
inbox:{public_id}                → cached inbox summary (TTL = time to expiry)
inbox:{public_id}:messages        → sorted set of message IDs by received_at
ratelimit:ip:{hash}:{endpoint}    → counter, TTL window
ratelimit:session:{id}:{endpoint} → counter, TTL window
alias:check:{local_part}:{domain}→ short TTL cache for availability checks
pubsub:inbox:{public_id}          → channel for SSE fan-out
```

---

# 📄 FILE: `SECURITY.md`

## Firebase Usage Note
Core data (inboxes/messages) lives in PostgreSQL, **not** Firebase, for relational integrity and full control over deletion lifecycle. Firebase (free Spark plan) is used **only** for two optional, non-sensitive capabilities: (1) Web Push relay via **FCM**, (2) lightweight anonymous **Firestore** doc used purely as a real-time "inbox has new mail" ping mirror for browsers where SSE is blocked by network policy (a fallback signal only — never the source of truth, never stores message content).

### Firestore Data Model (fallback signal only)
```
/inboxPings/{publicInboxId}
    lastMessageAt: timestamp
    unreadCount: number
    expiresAt: timestamp
```
No message content, sender data, or PII ever written here.

### Firestore Security Rules (conceptual, to adapt in `firestore.rules`)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /inboxPings/{inboxId} {
      // Clients may only read the ping doc for an inbox they can prove
      // knowledge of via a signed, short-lived custom token minted by
      // the backend after validating session ownership.
      allow read: if request.auth != null
                  && request.auth.token.inboxId == inboxId;

      // Only the trusted backend service account may write pings.
      allow write: if false; // writes happen exclusively via Admin SDK
    }

    // Deny everything else by default.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Firebase Cloud Messaging Rules
- Subscription tokens stored server-side (Postgres `notification_subscriptions`), never exposed client-to-client.
- Push payload contains **no message content** by default (`"New email received"` only), per §35 notification privacy rule.
- Custom auth tokens minted server-side are single-purpose (`inboxId` claim only), expire in ≤10 minutes, and are never reused across inboxes.

## App Lock Flow (Logic Description — No Code)

**Purpose:** Protect the *local device UI session* (not the server data) from casual shoulder-surfing/unauthorized phone access, since a temp inbox can contain sensitive OTPs.

**Setup flow:**
1. User enables "App Lock" in Settings.
2. Client checks for platform biometric availability (WebAuthn platform authenticator). If available, offers "Use biometric" as primary, PIN as fallback. If unavailable, PIN-only.
3. PIN (4–6 digits) is never stored in plaintext or transmitted to the server. It is used to derive a local key (e.g., via a slow key-derivation function) that encrypts a small local "unlock marker" stored in browser storage. The server has no knowledge of the PIN and cannot reset it — it is purely a local gate.
4. A "Forgot PIN" action clears local encrypted state only; it does **not** delete or affect the server-side inbox, which continues to exist until its own expiration.

**Unlock flow (on app resume / cold start when lock enabled):**
1. App detects lock flag in local state on load, before rendering inbox content — shows the Lock screen immediately, blocking rendering of any message data underneath (data is not fetched/rendered until unlocked, to avoid flash-of-content).
2. User authenticates via biometric prompt or PIN pad.
3. On success: unlock marker is validated locally, session resumes exactly where left off, and the inbox data fetch proceeds.
4. On repeated failure (e.g., 5 attempts): a temporary cool-down timer is enforced locally (progressively increasing delay) to slow brute-force PIN guessing; it does not lock the user out of the server-side inbox (they could still recover via the session token page from another device if truly locked out locally).
5. **Auto-lock triggers:** app backgrounded for > configurable idle threshold (default 2 minutes), manual "Lock now" action, or device screen lock detected via visibility API.
6. App Lock is a **client-side convenience/privacy feature**, explicitly documented as not a substitute for account security, since there is no traditional account.

## Threat Model
(As baseline T1–T7, retained) plus:

**T8 — Custom Alias Enumeration/Squatting:** Attacker scripts alias-availability checks to scrape desirable names or repeatedly claims-and-abandons popular names. Mitigation: per-IP/session rate limit on availability checks, cooldown ledger (`custom_aliases` table), CAPTCHA escalation after N checks/minute.

**T9 — Fallback Firestore Channel Abuse:** Attacker attempts to read ping data for inboxes they don't own. Mitigation: custom-token minting scoped to a single `inboxId` claim, short TTL, rules deny-by-default.

**T10 — App-Lock Bypass via DevTools:** Local-only lock is inherently bypassable by a technical local attacker with device access; mitigated by clearly scoping App Lock as anti-shoulder-surfing, not a cryptographic guarantee, and by never storing decrypted message bodies in a way retrievable without the normal fetch+render path (in-memory only, not persisted unencrypted to disk/localStorage).

## Required Browser/Client Permissions
| Permission | Purpose | Default |
|---|---|---|
| Clipboard write | Copy address | Granted on user gesture only (no clipboard read) |
| Notifications | New-mail alerts | Off, opt-in |
| Camera (optional, Phase 3) | Scan QR to open address on new device | Off, opt-in, used momentarily, never stored |
| Storage (IndexedDB/localStorage) | Session token, app-lock marker, preferences | Required minimum, documented in Privacy Policy |
| Background Sync (PWA) | Refresh inbox ping when reopened | Optional |

## Security Headers (final policy, to validate against actual CSP report-only run before enforcing)
`Strict-Transport-Security`, `Content-Security-Policy` (strict, `default-src 'self'`, sandboxed `frame-src` only for message-render iframe on a **separate cookieless subdomain**, e.g., `mail-render.studenttemp.example`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (deny camera/mic/geo by default), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`.

**Critical isolation rule:** The message-HTML iframe renderer is served from a **separate, cookieless, no-JS-execution-context domain** from the main app, so even a sanitizer bypass cannot access app session data (defense-in-depth beyond sanitization alone).

---

# 📄 FILE: `WORKFLOWS.md` (App Logic Behavior — Described, Not Coded)

## Inbox Generation Flow
1. Client requests a new inbox (no auth required for anonymous default).
2. Server generates a cryptographically random local-part with sufficient entropy, checks uniqueness against active inboxes for the chosen domain, and creates a session if none exists (returns a session token to store client-side, hashed copy stored server-side).
3. Server sets `expires_at` per selected/default preset, inserts the inbox row, warms the Redis cache entry, and returns the public inbox identifier + address + expiry to the client.
4. Client stores the session token securely (never exposes it in the URL) and opens an SSE connection scoped to that inbox's public ID.

## Custom Alias Claim Flow
1. Client types a desired local-part; client debounces and calls the availability check endpoint.
2. Server validates format, checks reserved-word/profanity list, checks `custom_aliases` cooldown ledger, checks current `inboxes` table for active conflicts, and returns availability plus a short-lived reservation token if available.
3. On confirm, client submits the reservation token; server re-validates atomically (transaction with row lock) to prevent race conditions between two users claiming the same name simultaneously, then creates the inbox.
4. On expiry of a custom-alias inbox, the ledger records a cooldown window before the same name becomes claimable again.

## Real-Time Mail Delivery Flow
1. Inbound SMTP connection hits the Mail Gateway; recipient is validated against active, non-expired inboxes before accepting the message (rejects unknown/expired recipients early to reduce backscatter and storage waste).
2. Accepted message is queued; Mail Processor parses MIME, extracts headers, computes SPF/DKIM/DMARC results (from received headers/environment, not fabricated), sanitizes HTML, stores sanitized HTML and any attachments in object storage, and inserts DB rows.
3. Processor publishes an event on the Redis pub/sub channel scoped to the inbox's public ID.
4. Any connected SSE client subscribed to that channel receives a lightweight "new message" event and requests the updated message list via the API (avoids pushing full content over the real-time channel unnecessarily).
5. If no client is connected, the Firestore fallback ping (if enabled) is updated so a reconnecting client or push notification can reflect the new state.

## Expiration & Cleanup Flow
1. A scheduled cleanup worker continuously scans the partial index of active inboxes nearing/past `expires_at`.
2. At the warning thresholds (15 min / 5 min / 1 min remaining), the server does not need to push anything extra — the client computes and displays countdown locally from the authoritative `expires_at` timestamp, re-synced periodically to correct clock drift.
3. At expiry, the inbox status transitions to `expired`; a grace-restore window may apply per policy (single use, rate-limited) allowing a short extension if requested before hard deletion.
4. After the grace window (or immediately if none applies), the cleanup worker deletes attachments from object storage first, confirms deletion, then deletes DB rows for attachments, messages, and finally the inbox row (or soft-marks and purges on a delayed final sweep, per the documented retention policy), invalidates the Redis cache entry, and removes any Firestore ping doc.
5. Cleanup emits an audit-style internal metric (counts only, no content) for observability.

## Abuse Detection & Response Flow
1. Every inbound request (API and SMTP) is scored using layered signals: IP reputation, request rate over sliding windows, behavioral anomalies (e.g., rapid sequential availability checks), and session risk history.
2. Low risk → allowed normally. Medium risk → challenge (e.g., proof-of-work or CAPTCHA) inserted before the action completes. High risk → request blocked and an `abuse_events` record is written (hashed IP only).
3. Persistent high-risk sources accumulate a reputation penalty that can escalate to temporary IP/subnet blocking at the edge (Cloudflare WAF rule), independent of the application layer, for defense-in-depth.
4. Domain-level abuse (e.g., a specific operator domain attracting spam/backscatter complaints) can be disabled independently via the Domain kill-switch without affecting other domains or the whole service.

## App Lock Flow
Described in full in `SECURITY.md` above.

## Notification Flow
1. User opts in to notifications; client requests browser permission and registers a push subscription, sent to the server and stored against the current session.
2. On new-message events, the Notification Service sends a minimal, content-free push payload ("New email received in student-xxxx@...") respecting the user's preview preference.
3. Tapping the notification deep-links directly to the relevant inbox/message screen, re-validating session ownership before rendering.

## Error Handling Philosophy
Every user-facing failure must (a) explain what happened in plain language, (b) offer a concrete next action (Retry / Create New / Go Home), and (c) log a correlation/request ID visible to the user for support purposes, without ever exposing stack traces, internal IDs, or sensitive diagnostic data in the UI.

---

# 📄 FILE: `CI-CD.md` (100% Free Pipeline)

## Pipeline (GitHub Actions — free tier)
```
on: push/pull_request
1. Checkout
2. Setup Node + Go toolchains (cached)
3. Lint (eslint, golangci-lint)
4. Type check (tsc --noEmit)
5. Unit tests (frontend + backend), coverage threshold gate
6. Integration tests (spin up ephemeral Postgres + Redis via GH Actions services, run against real containers — not mocks)
7. Security scan (npm audit / govulncheck, secret scanning via gitleaks)
8. Dependency review action
9. Build artifacts (frontend static bundle, Go binaries)
10. Container build + scan (Trivy) if containerized
11. Deploy to Staging (Cloudflare Pages preview + staging API instance) on PR
12. Smoke tests against staging (synthetic inbox creation + real test-domain email round trip)
13. Manual approval gate for Production
14. Deploy to Production (Cloudflare Pages production + Fly.io/Oracle VM release)
15. Post-deploy health check + automatic rollback trigger if health check fails
```

## Free-Tier Deployment Topology
| Component | Free Service |
|---|---|
| Frontend PWA | Cloudflare Pages (unlimited free static hosting) |
| BFF/API (TS) | Fly.io free allowance or Render free web service |
| Mail Gateway/Security Core (Go) | Oracle Cloud "Always Free" ARM VM (generous free compute) |
| Database | Neon.tech or Supabase free Postgres tier |
| Cache/Queue | Upstash Redis free tier |
| Object Storage | Cloudflare R2 free tier (10GB) |
| DNS/CDN/WAF | Cloudflare free plan |
| Inbound SMTP | Cloudflare Email Routing → Worker webhook, or Postfix on the same free Oracle VM |
| Push | Firebase Cloud Messaging (free, unlimited) |
| Monitoring | Grafana Cloud free tier + Uptime Robot free tier |
| Error tracking | Sentry free developer tier |

This combination allows a fully functional production deployment at **$0 fixed infra cost** at small-to-moderate scale, with a clear upgrade path (paid tiers) purely triggered by real traffic growth, not by design lock-in.

---

# 📄 FILE: `SOP.md` (Standard Operating Procedures / Pre-Release Checklist)

## Phase-by-Phase Delivery Plan

**Phase 0 — Foundations (Weeks 1–2):** repo scaffolding, design system tokens, CI pipeline skeleton, domain/DNS setup, Postgres schema migration tooling, base security headers, legal pages drafted.

**Phase 1 — MVP Core (Weeks 3–7):** real SMTP receive path end-to-end, inbox generation, message list/reader with sanitization, expiration + cleanup worker, basic rate limiting, responsive UI for Screens 1,2,4,5,10,12, monitoring basics, security review, load test at target baseline, private beta.

**Phase 2 — Real-Time & Personalization (Weeks 8–12):** SSE/WS, custom alias engine, Indian domain pack, QR sharing, multi-inbox tray, PWA installability, notifications, dark mode, i18n (5 languages), App Lock.

**Phase 3 — Developer & Scale (Weeks 13–18):** public API + docs, multi-domain admin tooling, advanced abuse intelligence, audit logging, RBAC admin roles, analytics dashboards.

**Phase 4 — Advanced (Weeks 19+):** sandbox/test inboxes, webhook delivery, email-render compatibility testing tools — kept architecturally separate from the public disposable-mail surface.

## Pre-Release Checklist (Go/No-Go)
- [ ] SMTP receiving verified against 5+ real major mail providers (Gmail, Outlook, Yahoo, etc.)
- [ ] XSS payload corpus tested against sanitizer/iframe isolation — zero escapes
- [ ] Attachment pipeline tested with EICAR test file and archive-bomb sample
- [ ] Expiration cleanup verified to actually remove DB rows + object storage blobs (not just hide in UI)
- [ ] Rate limiting verified under simulated burst load
- [ ] Custom alias race-condition test (concurrent claim attempts) passes
- [ ] Firestore/Firebase rules tested with Firebase Emulator (unauthorized read attempts denied)
- [ ] Accessibility audit (axe-core) zero critical issues
- [ ] Lighthouse performance ≥ 90 mobile
- [ ] Security headers verified via securityheaders.com-equivalent scan
- [ ] Backup restoration drill performed successfully
- [ ] Incident response runbook exists and on-call contact defined
- [ ] Privacy Policy, Terms, Acceptable Use, Abuse Policy published and linked in-app
- [ ] Rollback procedure tested in staging
- [ ] No mock/placeholder/TODO markers present in production branches (automated lint rule enforced in CI)
- [ ] Load test sustained at 3× expected launch traffic without degradation beyond agreed SLO

---

This documentation set (`PRD.md`, `AGENT.md`, `SCREENS.md`, `DESIGN-SYSTEM.md`, `DATABASE.md`, `SECURITY.md`, `WORKFLOWS.md`, `CI-CD.md`, `SOP.md`) forms the complete, phase-by-phase blueprint required to build, secure, test, and ship StudentTemp as a real, production-grade, honest temporary-email platform — with customizable addresses and an India-focused student domain pack — without ever fabricating institutional identity or backend behavior.
