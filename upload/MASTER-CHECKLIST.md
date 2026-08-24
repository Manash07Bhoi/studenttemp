# 📄 FILE: `MASTER-CHECKLIST.md` — Final Completion, QA & Publish-Readiness Protocol

**Purpose:** This is the **single authoritative gate** that determines whether StudentTemp is actually done — not "looks done." It exists specifically to catch the exact failure mode you described: an AI coding agent (or a rushed human) skipping details, leaving mock/placeholder logic, breaking navigation, or shipping half-working features while claiming completion.

**Rule for the coding agent:** This checklist must be run **literally, item by item**, not summarized or assumed. Every unchecked or "partially done" item blocks release. No item may be marked complete without a verifiable test/proof, not a self-declaration.

---

## 0. Developer Credit Requirement (Mandatory, Non-Negotiable)

- [ ] Footer of every public page displays: `Developed by Roshan` (or `Made with ❤️ by Roshan`), styled per Design System, always visible, not removable via any settings/theme toggle
- [ ] `About` screen has a dedicated "Credits" section crediting **Roshan** as the developer/creator
- [ ] `package.json` → `"author": "Roshan"` field set correctly (frontend + backend + admin apps)
- [ ] PWA `manifest.json` → include `"developer": "Roshan"` in custom metadata field (non-standard field, but retained as internal record)
- [ ] `README.md` root file has a "Built By" section crediting Roshan with contact/portfolio link placeholder (real link, not `#`/fake link)
- [ ] Admin dashboard footer also credits Roshan (internal tool, but consistency matters)
- [ ] License/legal footer text does not contradict or omit this credit line

---

## 1. Anti-Fake / Anti-Mock Automated Audit (Run First, Before Anything Else)

This is a **mechanical, scriptable gate** — must be run via CI, not eyeballed.

- [ ] Full repo text-search for forbidden tokens returns **zero results** in any `/apps`, `/services`, `/packages` production path: `TODO`, `FIXME`, `XXX`, `mock`, `dummy`, `fake`, `placeholder`, `sample data`, `lorem ipsum`, `test@test.com`, `console.log(` (debug leftovers), `hardcoded`, `stub`
- [ ] Confirm `/tests/fixtures` is the **only** location where test-double data may exist, and confirm nothing in `/apps` or `/services` imports from `/tests/fixtures`
- [ ] Confirm no API endpoint returns a hardcoded/static JSON response disguised as live data — every response traced back to an actual DB query, real SMTP event, or real third-party API call
- [ ] Confirm SPF/DKIM/DMARC values displayed in UI are parsed from actual `Authentication-Results` headers of received mail — not hardcoded `"pass"` defaults
- [ ] Confirm malware scan status is a real ClamAV response (`clean`/`quarantined`/`failed`) — test explicitly using the EICAR test file and confirm it is correctly flagged as quarantined, not silently marked clean
- [ ] Confirm attachment downloads are real files from object storage, not placeholder binary blobs
- [ ] Confirm every "empty state," "loading state," and "error state" described in `SCREENS.md` is wired to a **real condition** (actual empty array, actual pending fetch, actual caught exception) — not a static mockup screen that never triggers dynamically
- [ ] Confirm analytics dashboard (Umami/Plausible) shows real event counts from real user traffic in staging — not seeded fake numbers
- [ ] Confirm admin dashboard system-status indicators (`SMTP: Healthy`, `Queue: Healthy`, etc.) are wired to real health-check pings, not hardcoded "Healthy" strings

**Verification method:** Automated grep/lint rule in CI (already specified in `SOP.md` pre-release checklist) must fail the build if any forbidden token is found outside `/tests`.

---

## 2. Screen-by-Screen Completeness Audit

For **every single screen** listed in `SCREENS.md` (Splash, Home, Customize Sheet, Message List, Message Reader, Security Panel, QR Share, Attachment Preview, My Addresses, Settings, App Lock, Expired Inbox, How It Works/FAQ/Legal, Admin Dashboard, Onboarding), verify **all** of the following individually — do not batch-approve:

- [ ] Screen renders correctly at 320px, 375px, 414px, 768px, 1024px, 1440px, 1920px widths (no overflow, no clipped text, no broken layout)
- [ ] Loading state implemented and actually triggers on slow network (test with throttled 3G simulation)
- [ ] Empty state implemented and actually triggers with zero data (test with a genuinely empty inbox)
- [ ] Error state implemented and actually triggers on forced failure (test by killing backend/API connection mid-use)
- [ ] All buttons/links on screen are functional — none are dead/no-op elements
- [ ] All animations specified in `MOTION-SYSTEM.md` for this screen are implemented and match timing/easing specs
- [ ] Reduced-motion fallback verified by enabling `prefers-reduced-motion` OS setting and re-testing
- [ ] Dark mode verified — contrast checked, no invisible text, no broken icon colors
- [ ] Back navigation (arrow + gesture + browser back button) tested explicitly and returns to correct previous state, not a broken/blank screen
- [ ] Keyboard navigation (Tab/Shift+Tab/Enter/Escape) fully functional, focus order logical
- [ ] Screen reader tested (VoiceOver/NVDA/TalkBack) announces all interactive elements correctly with proper labels
- [ ] Touch targets measured ≥44×44px on mobile
- [ ] No console errors/warnings in browser DevTools while interacting with this screen

---

## 3. Complete Navigation Audit

- [ ] Hamburger (3-line) menu opens/closes correctly from every screen it's present on, with correct animation (slide-in drawer)
- [ ] Every item in the drawer navigates to the correct destination — test each one individually, not just the first two
- [ ] Bottom navigation (mobile) correctly highlights the active tab and switches content without full page reload
- [ ] Back arrow present on every non-root screen; tapping it returns to the exact correct parent screen, not just "any previous page"
- [ ] Browser/hardware back button intercepted correctly: closes open modal/sheet first → then navigates screen history → then exits app (double-back-to-exit toast tested on Android)
- [ ] Deep links (e.g., notification tap → specific message) navigate directly to the correct screen with correct data loaded, not just to Home
- [ ] No navigation dead-ends (every screen has at least one way back to Home)
- [ ] No navigation loops that trap the user (e.g., back arrow leading to a screen that has no way back)
- [ ] URL routing (if applicable) reflects current screen state correctly and supports refresh without breaking (state rehydrates from server/session, not lost on F5)
- [ ] 404/unknown-route screen exists and offers a way back to Home

---

## 4. Functional Logic & Business Rule Verification

Go through every workflow in `WORKFLOWS.md` and confirm actual behavior, not assumed behavior:

- [ ] Inbox generation produces a genuinely random, collision-checked address every time (test by generating 100+ inboxes rapidly and confirming zero duplicates)
- [ ] Custom alias availability check correctly rejects reserved words, profanity, and already-taken names (test each category explicitly)
- [ ] Custom alias race condition tested: two simultaneous claim attempts for the same name — confirm exactly one succeeds, the other gets a clean "just taken" error, not a crash or duplicate row
- [ ] Real email sent from an external provider (Gmail/Outlook) actually arrives in the generated inbox within acceptable latency (test end-to-end, not simulated)
- [ ] HTML email with embedded `<script>` tag confirmed to **not execute** in the reader (test with a real crafted test email)
- [ ] External links in email body confirmed to show interstitial warning before navigating away
- [ ] Remote image/tracking-pixel blocking toggle actually blocks/unblocks images when tested
- [ ] Countdown timer counts down accurately in real time and matches server `expires_at`, resyncing on tab refocus (test by deliberately changing system clock to confirm server-authoritative correction)
- [ ] Inbox actually becomes inaccessible at expiry — attempt to access an expired inbox's API endpoint directly and confirm proper rejection (not just UI hiding it)
- [ ] Cleanup worker verified to actually delete DB rows AND object storage files after expiry — check the database and storage bucket directly post-expiry, don't trust the UI alone
- [ ] Rate limiting actually blocks excessive requests (test by scripting rapid repeated requests and confirming a 429 response after threshold)
- [ ] Turnstile challenge actually appears after triggering medium-risk behavior (test the escalation path deliberately)
- [ ] App Lock PIN actually blocks content rendering until correct PIN entered (test by force-locking and confirming no message data is visible/present in DOM before unlock)
- [ ] Session recovery code actually restores the correct inbox on a different browser/device (test cross-device explicitly)
- [ ] Notification permission pre-prompt → real browser permission → actual push received on new mail (test end-to-end with a real push, not a simulated toast)
- [ ] Report Abuse flow actually creates a record visible in the Admin review queue (verify from admin side, not just a "Thanks" toast on user side)
- [ ] Data export produces a real, valid `.zip` of `.eml` files that open correctly in a real email client (test by actually opening the exported files)

---

## 5. Security Verification (Actual Testing, Not Documentation Review)

- [ ] XSS payload corpus (OWASP-standard test payloads) submitted via email body — confirm zero execution across all payload variants
- [ ] SQL injection attempts against every input field (search, custom alias, session recovery) — confirm parameterized queries hold, no error leakage
- [ ] CSRF token verified — attempt a state-changing request without a valid token, confirm rejection
- [ ] Session cookie inspected in DevTools — confirm `HttpOnly`, `Secure`, `SameSite=Strict` flags actually present, not just documented
- [ ] Attempt direct API access to another user's inbox/message by guessing/incrementing IDs (IDOR test) — confirm rejection due to opaque IDs + ownership checks
- [ ] Attempt SSRF via any URL-accepting field (if any exists, e.g., avatar-from-URL if ever added) — confirm private IP ranges blocked
- [ ] Malware test file (EICAR) uploaded as attachment — confirm quarantine, confirm quarantined file is **not downloadable**
- [ ] Archive bomb / oversized decompression test file uploaded — confirm rejection before resource exhaustion
- [ ] Homograph/punycode spoofed sender address tested — confirm UI displays warning/raw address clearly
- [ ] Security headers verified via live scan (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) — confirm actual response headers, not just intended policy in docs
- [ ] Admin login tested with MFA — confirm login fails without valid TOTP code
- [ ] Admin RBAC tested — confirm a "Read Only" role genuinely cannot perform write actions via direct API call, not just hidden buttons in UI
- [ ] Audit log verified to actually record real admin actions with correct timestamps and actor IDs
- [ ] Firestore security rules tested using the Firebase Emulator — confirm unauthorized read attempts are denied
- [ ] Dependency vulnerability scan (npm audit / govulncheck / Trivy) run and all Critical/High findings resolved or explicitly risk-accepted with documented justification

---

## 6. Performance & Stability Verification

- [ ] Lighthouse (mobile) score ≥90 for Performance, Accessibility, Best Practices, SEO — actual scan run, not estimated
- [ ] First Contentful Paint measured under throttled 3G — confirm within acceptable target (<2.5s)
- [ ] Load test executed at 3× expected launch traffic (documented tool: k6 or Artillery, both free) — confirm no error-rate spike, no latency collapse
- [ ] SMTP gateway load tested with concurrent inbound connections — confirm no dropped connections at target volume
- [ ] Memory leak check: leave inbox open with SSE connection active for 1+ hour, confirm no unbounded memory growth in browser tab
- [ ] Database query performance checked — confirm indexes are actually used (via `EXPLAIN ANALYZE`) for hot-path queries (inbox lookup, message list)
- [ ] Redis cache hit rate monitored — confirm cache is actually reducing DB load, not being bypassed
- [ ] Object storage upload/download latency measured for attachments at max allowed size
- [ ] Confirm graceful degradation: kill Redis temporarily and confirm app degrades to direct DB queries rather than crashing entirely
- [ ] Confirm health check / readiness / liveness endpoints exist and return accurate real status

---

## 7. Responsive Design — Explicit Device/Breakpoint Matrix

Test physically or via accurate emulation on **all** of the following — check each row individually, do not assume "if it works on one mobile size it works on all":

| Device Class | Width | Verified? |
|---|---|---|
| Small mobile (iPhone SE) | 375px | [ ] |
| Standard mobile (iPhone 14/Pixel) | 390–414px | [ ] |
| Large mobile / small tablet | 480–600px | [ ] |
| Tablet portrait (iPad) | 768px | [ ] |
| Tablet landscape | 1024px | [ ] |
| Small laptop | 1280px | [ ] |
| Standard desktop | 1440px | [ ] |
| Large/wide desktop | 1920px+ | [ ] |
| Foldable (unfolded, e.g., 673–840px transitional) | variable | [ ] |

For each width, confirm:
- [ ] No horizontal scroll/overflow anywhere
- [ ] Touch targets remain ≥44px on touch devices, mouse targets appropriately sized on desktop (can be smaller with hover states)
- [ ] Bottom nav shown on mobile widths, hidden/replaced by sidebar or top nav on desktop widths (per design system breakpoint rules)
- [ ] Message reader remains readable (line length not excessively wide on ultra-wide desktop — max content width constraint applied)
- [ ] Modals/sheets adapt correctly (bottom sheet on mobile, centered modal on desktop) per `SCREENS.md` spec
- [ ] Images/QR codes scale correctly without pixelation or overflow
- [ ] Orientation change (portrait ↔ landscape) on mobile/tablet does not break layout or lose state

---

## 8. Cross-Browser Verification

- [ ] Chrome (desktop + Android)
- [ ] Firefox (desktop + Android)
- [ ] Safari (desktop + iOS)
- [ ] Edge (desktop)
- [ ] Samsung Internet (Android, common in target region)
- [ ] PWA install flow tested explicitly on both Android (Chrome "Add to Home Screen") and iOS (Safari "Add to Home Screen") — confirm icon, splash screen, and standalone mode all work correctly on both

---

## 9. Database & Backend Schema Verification

- [ ] Every table in `DATABASE.md` actually exists in the deployed schema with correct column types/constraints
- [ ] All foreign key constraints verified (attempt to insert orphaned records, confirm rejection)
- [ ] All indexes listed actually created (verify via `\d tablename` or equivalent, not assumed from migration file alone)
- [ ] Migration tool (`golang-migrate`/Prisma Migrate) runs cleanly on a fresh empty database with zero manual intervention
- [ ] Rollback migration tested — confirm a migration can be reversed cleanly in staging without data corruption
- [ ] Backup restoration drill actually performed — restore a backup to a separate environment and confirm data integrity
- [ ] Confirm no raw IPs stored beyond documented retention/hashing policy — spot-check `abuse_events` table directly

---

## 10. API Contract Verification

- [ ] `openapi.yaml` matches actual deployed endpoint behavior exactly — run contract testing (e.g., Dredd or Schemathesis) to confirm no drift
- [ ] Every endpoint returns the standardized success/error response format consistently
- [ ] Every endpoint has rate limiting applied and verified (not just documented)
- [ ] API versioning (`/api/v1`) confirmed functional; no breaking changes possible without version bump
- [ ] Error responses never leak stack traces, internal file paths, or database error messages to the client — test by deliberately triggering a server error and inspecting the response body

---

## 11. Compliance & Legal Gate (Pre-Public-Launch Only)

- [ ] Privacy Policy, Terms, Acceptable Use, Abuse Policy, Cookie Policy all published and linked in footer + drawer menu
- [ ] DPDP-compliant consent notice implemented and tested on first visit
- [ ] Data Principal Request (access/erasure) process documented and actually testable (submit a real test request and confirm it's handled per the documented SLA)
- [ ] Incident Response runbook exists as a real document (`INCIDENT-RESPONSE.md`), not just referenced
- [ ] Contact/Support form functional and tested end-to-end (submit a real test message, confirm it's received)

---

## 12. Final End-to-End Scenario Tests (Real User Journeys, Not Unit Tests)

Run these complete journeys manually, start to finish, on a real device:

- [ ] **Journey A:** New visitor → generates inbox → copies address → uses it to register on a real third-party test site → receives real verification email → reads it → clicks verify link → inbox later expires → data confirmed deleted
- [ ] **Journey B:** Returning visitor → customizes alias → claims Indian domain pack address → shares via QR → opens on second device via scanned QR → confirms both devices see same inbox
- [ ] **Journey C:** User enables App Lock → backgrounds app → returns → confirms lock screen blocks content → unlocks → confirms correct state resumed
- [ ] **Journey D:** User receives phishing-style test email → reports it → confirms it appears in Admin review queue → Admin reviews and takes action → confirms audit log entry created
- [ ] **Journey E:** Attacker simulation → scripted rapid inbox creation from single IP → confirms rate limit + Turnstile challenge triggers correctly → confirms abuse event logged

---

## 13. Final Sign-Off Table

| Category | Status | Signed Off By |
|---|---|---|
| Anti-Mock/Fake Audit | ☐ Pass ☐ Fail | |
| Screen Completeness | ☐ Pass ☐ Fail | |
| Navigation | ☐ Pass ☐ Fail | |
| Functional Logic | ☐ Pass ☐ Fail | |
| Security | ☐ Pass ☐ Fail | |
| Performance/Stability | ☐ Pass ☐ Fail | |
| Responsive Design | ☐ Pass ☐ Fail | |
| Cross-Browser | ☐ Pass ☐ Fail | |
| Database/Backend | ☐ Pass ☐ Fail | |
| API Contract | ☐ Pass ☐ Fail | |
| Legal/Compliance | ☐ Pass ☐ Fail | |
| End-to-End Journeys | ☐ Pass ☐ Fail | |
| Developer Credit (Roshan) | ☐ Pass ☐ Fail | |

**Release Rule:** Every single row must read "Pass" before production deployment is authorized. A single "Fail" anywhere blocks the entire release — no partial/soft launches on unresolved Fail items.

---

## How to Use This With an AI Coding Agent

Give the agent this explicit instruction alongside `AGENT.md`:

> "After implementing each feature, run the relevant section of `MASTER-CHECKLIST.md` against your own work before marking the task complete. If any item fails, fix it and re-test — do not report a task as done until every applicable checklist item genuinely passes. Do not mark an item as passed without describing exactly how you verified it (what you tested, what the result was)."

This closes the original problem you raised: instead of trusting the agent's self-report of "done," it is forced to produce **evidence of verification** against a fixed, comprehensive standard — and nothing ships until every real check, not just every documented feature, is actually true.
