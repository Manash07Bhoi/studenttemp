# 📄 FILE: `BUGFIX-INBOX-PERSISTENCE.md` — Fixing "Mail Disappears on Close/Minimize"

## Root Cause Analysis (Why This Bug Happens)

This bug happens when the architecture makes the **browser tab the source of truth** instead of the **server**. Specifically, one or more of these mistakes are present:

| Root Cause | What's Wrong |
|---|---|
| RC1 | Address stored only in React state (memory) — dies instantly when tab closes/JS context is destroyed |
| RC2 | Using `sessionStorage` instead of a persistent cookie/`localStorage` — `sessionStorage` is explicitly wiped on tab close by browser design |
| RC3 | No server-side DB record created at generation time — address was only ever a client-rendered string, never actually registered as an inbox |
| RC4 | App unconditionally calls "create new inbox" on every load instead of "restore existing session first" |
| RC5 | No persistent session cookie issued at all, so there's nothing for the server to look up on return |
| RC6 | On mobile PWA resume-from-minimize, app re-runs first-load logic instead of resume logic, re-triggering RC4 |

## The Fix — Correct Persistence Architecture

**Golden Rule:** *The server database is the only source of truth for whether an inbox exists and how much time it has left. The browser tab is just a viewer. Closing, minimizing, refreshing, or losing the tab must never delete or forget anything — only real time-based expiry (`expires_at` passed) or explicit user action ("Delete inbox") may remove it.*

### Required Changes
1. **On inbox creation:** server immediately writes the row to PostgreSQL with `expires_at`, and issues an `HttpOnly`, `Secure`, `SameSite=Strict` cookie with `Max-Age` matching the maximum policy window (e.g., 30 days, independent of the inbox's own expiry) — the cookie's job is only to identify *the session*, not to hold the expiry logic itself.
2. **Also store a non-sensitive mirror** (`public_id` + `expires_at`) in `localStorage` (not `sessionStorage`) as a redundant client-side hint — this survives tab close/reopen and lets the UI show something instantly while the server confirms.
3. **On every app load/resume (cold start, tab reopen, PWA foreground-resume, minimize-then-return):** the app must run a **"Restore, don't recreate"** check before rendering anything.

## Conditional Logic — App Load/Resume Decision Tree

```
APP LOAD OR RESUME EVENT TRIGGERED
│
├─ IF a valid session cookie exists
│   │
│   ├─ CALL server: "GET current session state"
│   │
│   ├─ IF server responds: inbox is ACTIVE
│   │     → Render Home screen with the SAME address, correct
│   │       remaining time computed from server's expires_at
│   │       (not from any locally-elapsed guess)
│   │     → Re-subscribe to real-time channel (SSE) for this inbox
│   │     → Fetch and display any messages that arrived while closed
│   │
│   ├─ IF server responds: inbox is EXPIRED
│   │     → Render Expired screen (Screen 12)
│   │     → DO NOT silently auto-create a replacement inbox
│   │     → User must explicitly tap "Create New Address"
│   │
│   ├─ IF server responds: NO inbox associated with this session
│   │  (e.g., user previously deleted it manually)
│   │     → Render Home in "no inbox yet" empty state
│   │     → Wait for explicit user action to create one
│   │
│   └─ IF server is unreachable (network/offline)
│         → Render cached localStorage mirror data in a
│           read-only/offline banner state: "Showing last known
│           state — reconnecting…"
│         → Retry connection with backoff
│         → DO NOT create a new inbox as a fallback — this is
│           exactly the bug being fixed; absence of connection
│           must never be interpreted as absence of data
│
└─ IF no session cookie exists at all (genuinely first visit,
     or cookies cleared by user/browser settings)
       → Render Home in "no inbox yet" empty state
       → Only NOW does "Create Temporary Email" become the
         active call-to-action the user must press
```

### Mobile/PWA-Specific Fix
- On `visibilitychange`/app-resume events, the app must run the **same restore check above**, never a fresh-boot "create inbox" call.
- Service Worker must **not** clear IndexedDB/localStorage on any lifecycle event — only an explicit "Clear my data" user action (Settings → Danger Zone) may do that.
- If the OS kills the PWA process entirely while backgrounded (common on low-RAM Android devices), the next foreground launch is functionally a "cold start" — the restore check above still applies and correctly recovers state from the server, because the server never depended on the tab staying alive.

### Multi-Device Consistency Note
Because the source of truth is server-side, opening the recovery code (`ST-7X9K-2Q4M`) on a second device correctly restores the **same inbox**, not a new one — this was already specified in `WORKFLOWS.md` but is now explicitly the same mechanism that fixes the close/minimize bug, unifying both problems under one correct architecture.

---

# 📄 FILE: `PRD-ADDENDUM-ACCOUNTS.md` — StudentTemp Accounts (Permanent Gmail-Class Mailbox)

## New Product Tier: Two Modes, One Platform

| Mode | Who | Address Lifetime | Login Required |
|---|---|---|---|
| **Temporary Mode** (existing) | Anonymous visitors | Minutes–24h, expires per policy | No |
| **Account Mode** (new) | Registered users | **Permanent**, until account deleted | Yes |

A visitor can start in Temporary Mode and **upgrade/claim** their current address into a permanent Account before it expires ("Claim this address permanently" CTA appears in the last hour of an active temp inbox).

## Full Feature Parity Matrix (Gmail-Class Features)

| Category | Feature | Included |
|---|---|---|
| Identity | Sign up (email or phone OTP + password) | ✅ |
| Identity | Permanent address `username@studentbox.in` (chosen once, unique forever) | ✅ |
| Identity | Profile setup (name, photo, recovery email/phone, DOB, language, timezone) | ✅ |
| Identity | Two-Factor Authentication (TOTP) | ✅ |
| Identity | Account recovery flow | ✅ |
| Identity | Multiple account switcher (like Google account switcher) | ✅ |
| Compose | Rich text compose, attachments, signature | ✅ |
| Compose | Undo Send (cancel window) | ✅ |
| Compose | Drafts (autosave) | ✅ |
| Compose | Scheduled send | ✅ (Phase 2 of Accounts) |
| Organization | Labels (custom, color-coded) + system labels (Inbox/Starred/Sent/Drafts/Spam/Trash/Important/All Mail) | ✅ |
| Organization | Folders/Categories (Primary/Social/Promotions/Updates — rule-based classification) | ✅ |
| Organization | Filters/Rules engine (condition → action) | ✅ |
| Organization | Snooze | ✅ |
| Organization | Archive | ✅ |
| Search | Gmail-style search operators | ✅ |
| Contacts | Auto-added + manual contacts, contact groups | ✅ |
| Anti-Spam | Spam folder, block sender, report spam, unsubscribe parsing | ✅ |
| Retention | **Customizable time limits per label/folder** | ✅ (new, see below) |
| Storage | Quota system with usage meter | ✅ |
| Aliases | Additional aliases forwarding into same inbox | ✅ |
| Automation | Vacation responder / auto-reply | ✅ |
| Data | Export all data (portability), Import mbox/eml | ✅ |
| UX | Keyboard shortcuts | ✅ |
| UX | Themes | ✅ |
| UX | Offline mode (PWA cached recent mail) | ✅ |

## "Customize Time Limits" — The Specific Feature Requested

This applies **per label/folder**, not as a single global switch (matches real Gmail-style retention behavior, e.g., Gmail auto-empties Trash after 30 days):

| Label/Folder | Default Retention | User-Configurable? |
|---|---|---|
| Inbox / Primary | Forever | ✅ Can set auto-archive after N days |
| Promotions | 30 days auto-delete | ✅ Adjustable 7–365 days or "Keep forever" |
| Social/Updates | 60 days auto-delete | ✅ Adjustable |
| Spam | 30 days auto-delete (fixed minimum for abuse evidence) | ❌ Cannot be set below 7 days |
| Trash | 30 days auto-delete | ✅ Adjustable 1–90 days |
| Custom user labels | Forever by default | ✅ Fully user-defined per label |
| Attachments (global) | Follows parent message's label policy | ✅ Independent override optional |

**Conditional Logic — Retention Policy Conflict Resolution:**
```
MESSAGE HAS RETENTION DECISION PENDING
│
├─ IF message has multiple labels with different retention policies
│     → Apply the LONGEST retention period among them
│       (never delete something the user marked to keep under
│        any label, even if another label on it says delete sooner)
│
├─ IF message is Starred
│     → Retention policy is IGNORED entirely; Starred overrides
│       auto-deletion until unstarred
│
├─ IF message is inside an active Filter's "never delete" exception
│     → Retention policy skipped for this message
│
└─ ELSE → apply the label's configured retention countdown from
          the message's received_at date
```

## Outbound Mail — Architecture Reconciliation

Accounts Mode requires **real outbound sending**, which the Temporary Mode intentionally excludes (per original abuse-prevention design). This is a genuine complexity/cost increase and must be engineered carefully:

- **Do not self-host outbound SMTP from day one** — a fresh IP has zero sender reputation and will be junk-folder'd universally regardless of code quality.
- **Recommended free-tier path:** Use a transactional email API as the outbound relay — **Resend** (free tier: 3,000 emails/month) or **Brevo** (free tier: 300/day) — both handle SPF/DKIM/DMARC and reputation on your behalf while you're small.
- Outbound is **only available to logged-in Account Mode users**, never anonymous Temporary Mode, and is rate-limited per account (e.g., 50 sends/day on Free account tier) to prevent the platform becoming a spam relay.
- Every outbound message is scanned by the same abuse-detection pipeline used for inbound before being handed to the relay API.

---

# 📄 FILE: `SCREENS-ACCOUNTS.md` — New Screens for Account Mode

## Screen A1 — Sign Up
**Fields:** Full name, desired permanent address (`username` + domain picker), password (or "Continue with phone OTP" alternative path), recovery email (optional but strongly recommended), Terms/Privacy checkbox.
**Live validation:** username availability check (same debounce pattern as Customize Address in Temp Mode), password strength meter.
**Conditional Logic:**
```
ON SUBMIT
├─ IF username unavailable → inline error, suggest 3 alternatives
├─ IF password weak (<8 chars, no complexity) → inline strength warning, block submit
├─ IF phone/email verification required
│     → send OTP → show OTP entry screen → verify → proceed
│     └─ IF OTP wrong 3x → cooldown timer before retry allowed
├─ IF all valid → create account, create permanent mailbox row,
│     issue session cookie, route to Profile Setup (Screen A2)
```
**Error State:** Network failure → "Couldn't create your account" + Retry, form data preserved (not cleared).

## Screen A2 — Profile Setup (New, as requested)
**Sections:**
1. **Profile photo** — upload or choose from generated monogram-avatar set (deterministic color, initials) — camera/gallery permission requested only on explicit tap
2. **Display name**
3. **Recovery options** — recovery email, recovery phone (at least one required before completing setup)
4. **Language & Region**
5. **Theme preference** (Light/Dark/System)
6. **Signature setup** (optional, can skip — default blank)
7. **Import existing contacts** (optional, skip-able)
**Progress indicator:** step dots (1 of 5 etc.), "Skip for now" available on optional steps but **not** on recovery-option step (security-critical, at least one recovery method enforced).
**Empty/Error states:** avatar upload failure → fallback to monogram automatically with a toast, never a broken image icon.
**Completion:** "Finish Setup" → routes to Inbox (Account Mode Home).

## Screen A3 — Account Mode Home (Inbox)
Gmail-style layout: left rail (Labels: Inbox, Starred, Snoozed, Sent, Drafts, Spam, Trash, All Mail, + custom labels), top search bar with operator support, category tabs (Primary/Social/Promotions/Updates) as a horizontal segmented control on mobile, message list center, Compose FAB (floating action button, bottom-right on mobile, top-left button on desktop).
**States:** identical discipline as Temp Mode — Empty/Loading/Error per label, skeleton loading, shimmer.

## Screen A4 — Compose
**Fields:** To (with contact autocomplete + chip-style recipient tags), Cc/Bcc (collapsed by default, expand link), Subject, Body (rich text toolbar: bold/italic/underline/list/link/attach), Attach button, Send button, Discard (trash icon).
**Conditional Logic:**
```
ON TAP SEND
├─ IF "To" field empty → block send, focus field, inline error
├─ IF recipient address format invalid → inline error per chip
├─ IF attachment(s) exceed size limit → block send, show which
│     attachment exceeds and the limit
├─ IF daily outbound quota reached → block send, show upgrade/
│     wait-until-reset message, save as Draft automatically
├─ ELSE → message enters "Sending…" state with Undo Send window
│     (default 10s, user-configurable 5/10/20/30s in Settings)
│     │
│     ├─ IF user taps Undo within window → cancel dispatch,
│     │     return to Compose with content intact
│     └─ IF window elapses without Undo → dispatch to outbound
│           relay, move to Sent, show confirmation toast
```
**Autosave Draft Logic:** every 2s of inactivity with unsaved changes, or on navigating away without sending → silently save/update Draft, show subtle "Saved" micro-text near the top of the compose window.

## Screen A5 — Labels & Filters Manager
**Labels tab:** list of labels with color swatch, rename/delete, retention-policy dropdown per label (the "customize time limits" control).
**Filters tab:** rule builder — Condition rows (From / To / Subject contains / Has attachment / Size greater than) combined with AND logic, Action rows (Apply label / Archive / Mark as read / Forward to / Delete / Never send to Spam) — "Create Filter" preview shows a plain-language summary before saving (e.g., *"When mail is from `newsletter@` → apply label 'Promotions' and archive"*).
**Conditional Logic — Filter Execution Order:**
```
NEW MESSAGE ARRIVES
├─ Run through Filters in the order the user has arranged them
│   (drag-to-reorder list, top = highest priority)
├─ IF a filter's condition matches → apply its actions,
│     THEN continue evaluating remaining filters (multiple
│     filters can apply to the same message) UNLESS this
│     filter's action includes "Delete" or "Skip remaining
│     filters" (an explicit stop option), in which case halt
├─ IF no filters match → apply default categorization heuristic
│     (Primary/Social/Promotions/Updates rule-based classifier)
```

## Screen A6 — Contacts
List/search contacts, add/edit/delete, group management, "Add from recent correspondence" suggestion list (auto-populated from Sent/Received, requires one explicit tap to confirm add — never silently auto-saved to protect privacy).

## Screen A7 — Storage & Data Settings
Storage usage meter (bar chart: Mail / Attachments / Trash breakdown), "Free up space" suggestions (largest attachments, oldest Promotions), Export All Data button, Import Mail button, Delete Account (Danger Zone, requires password re-entry + typed confirmation phrase).
**Conditional Logic — Storage Quota:**
```
ON NEW INCOMING MESSAGE (Account Mode)
├─ IF account storage usage ≥ 100% of quota
│     → REJECT new mail at SMTP level with a proper bounce
│       to sender (unlike Temp Mode, Account Mode mailboxes
│       DO generate standard "mailbox full" DSN bounces —
│       this is expected, standard mail-server behavior)
│     → Notify account owner in-app: "Your mailbox is full"
│       with a direct link to Storage Settings
├─ IF usage ≥ 90% (warning threshold)
│     → Show persistent but dismissible banner in Inbox
└─ ELSE → accept normally
```

## Screen A8 — Security Settings (2FA)
Enable/disable TOTP (QR code + manual key entry, standard authenticator app flow), backup codes generation (10 single-use codes, downloadable once), active sessions/devices list with "Sign out" per device, login activity log (timestamp, approximate location from IP, device type).
**Conditional Logic — Login with 2FA enabled:**
```
ON LOGIN ATTEMPT
├─ Verify email/phone + password
│   ├─ IF invalid → generic error ("Incorrect email or password")
│   │     — never reveal which field was wrong (prevents
│   │       account enumeration)
│   └─ IF valid AND 2FA enabled
│         → prompt for 6-digit TOTP code
│         ├─ IF correct → issue session, log device/IP
│         ├─ IF incorrect → allow retry, after 5 fails →
│         │     temporary lockout + email alert to account
│         │     owner ("New failed login attempts detected")
│         └─ IF user selects "Use backup code" → validate
│               against unused backup codes list, invalidate
│               it after single use
```

## Screen A9 — Account Switcher
Bottom sheet/dropdown listing all logged-in accounts on this device (Temp session + any permanent Accounts), "Add another account," "Sign out of all."

## Screen A10 — Vacation Responder Settings
Toggle on/off, start/end date range, subject/body template, "Send only to contacts" checkbox, "Only once per sender" logic explanation.
**Conditional Logic:**
```
ON INCOMING MESSAGE while Vacation Responder is ACTIVE
├─ IF sender already received an auto-reply from this account
│     within the current vacation period → do NOT send again
│     (prevents auto-reply loops and spam)
├─ IF "Send only to contacts" enabled AND sender not in Contacts
│     → skip auto-reply
├─ IF sender address matches known no-reply/bulk patterns
│     (e.g., "no-reply@", "noreply@", bulk headers present)
│     → skip auto-reply (prevents mail-loop with other
│       automated systems)
└─ ELSE → send configured auto-reply once, log it
```

---

# 📄 FILE: `DATABASE-ADDENDUM-ACCOUNTS.md`

New tables required for Account Mode:

```
accounts
--------
id, email, phone, password_hash, permanent_address, domain_id,
display_name, avatar_key, recovery_email, recovery_phone,
totp_secret_encrypted, totp_enabled, storage_quota_bytes,
storage_used_bytes, created_at, status

labels
------
id, account_id, name, color, retention_days (nullable = forever),
is_system_label, created_at

message_labels (many-to-many)
------------------------------
message_id, label_id

filters
-------
id, account_id, priority_order, conditions (jsonb),
actions (jsonb), stop_processing (bool), created_at

contacts
--------
id, account_id, name, email, group_name, source
  ('manual','auto_suggested'), created_at

drafts
------
id, account_id, to, cc, bcc, subject, body, attachments (jsonb),
last_saved_at

sent_messages
-------------
id, account_id, to, subject, sent_at, relay_provider,
relay_message_id, status ('sent','failed','bounced')

aliases
-------
id, account_id, alias_address, created_at, active

login_sessions
---------------
id, account_id, device_info, ip_hash, created_at, last_seen_at,
revoked

backup_codes
------------
id, account_id, code_hash, used (bool)

vacation_responder
-------------------
id, account_id, enabled, start_date, end_date, subject, body,
contacts_only (bool)
```

---

# 📄 FILE: `LOGIC-TREES-GLOBAL.md` — Additional Cross-Cutting Conditional Logic

## Temp Mode ↔ Account Mode Mode-Switching Logic
```
APP DETERMINES ACTIVE MODE ON LOAD
├─ IF valid Account session cookie present → Account Mode UI
│     (Gmail-style layout, labels, compose FAB visible)
├─ ELSE IF valid Temp session cookie present → Temporary Mode UI
│     (single-inbox hero layout, countdown chip visible)
├─ ELSE → show Landing/Home with two clear entry points:
│     "Create Temporary Email" (no login) vs
│     "Sign in / Create Account" (permanent mailbox)
```

## "Claim This Address Permanently" (Temp → Account Upgrade)
```
TEMP INBOX HAS ≤ 60 MINUTES REMAINING
├─ Show "Claim this address permanently" banner in Home
├─ ON TAP
│   ├─ IF user has no Account yet → route to Sign Up, pre-fill
│   │     desired username from current temp local-part
│   │     (still subject to permanent-address availability
│   │      check — a temp local-part isn't automatically
│   │      guaranteed available as a permanent one)
│   ├─ IF username unavailable as permanent → offer
│   │     alternatives, same as normal signup flow
│   └─ ON successful claim → migrate existing received
│         messages from the temp inbox into the new permanent
│         mailbox's Inbox label, mark temp inbox as
│         "converted" (not expired, not deleted — converted)
```

## Compose Recipient Validation
```
ON EACH RECIPIENT CHIP ADDED
├─ IF format invalid (no @, bad domain syntax) → reject chip,
│     shake animation, inline error
├─ IF domain has no valid MX record (real DNS lookup) →
│     warn but allow send (some valid domains still fail
│     lookup due to network issues — don't hard-block)
├─ IF recipient is in user's own Block list → block chip,
│     "You've blocked this address" message
└─ ELSE → accept chip
```

---

# 📄 FILE: `MASTER-CHECKLIST-ADDENDUM.md` — Additional QA Items for Accounts

- [ ] Sign up → Profile Setup → Inbox flow tested end-to-end with a real new account
- [ ] Permanent address uniqueness enforced — attempt duplicate claim, confirm rejection
- [ ] 2FA setup, login-with-2FA, and backup-code recovery all tested for real
- [ ] Outbound send tested via real relay provider (Resend/Brevo) — confirm delivery to a real Gmail/Outlook inbox, check spam folder placement
- [ ] Undo Send tested — confirm cancelling within window genuinely prevents dispatch (check relay provider logs to confirm no send occurred)
- [ ] Filter rule engine tested with multiple overlapping filters — confirm execution order and stop-processing logic behave exactly as specified
- [ ] Retention policy tested per label — confirm messages actually get deleted at the configured interval and Starred/exception messages are correctly preserved
- [ ] Storage quota enforcement tested — fill account near quota, confirm warning banner, confirm hard rejection with real bounce at 100%
- [ ] Vacation responder loop-prevention tested — confirm no infinite auto-reply loop between two vacation-enabled accounts
- [ ] **Inbox persistence bug explicitly re-tested:** create inbox → close tab completely → reopen after 10+ minutes → confirm same address and messages present; repeat test with mobile app minimize/resume; repeat test with airplane-mode-then-reconnect
- [ ] Account Mode and Temporary Mode session cookies confirmed isolated (no cross-contamination between an anonymous temp session and a logged-in account session in the same browser)
- [ ] Developer credit (Roshan) confirmed present in Account Mode footer/About screen as well, not just Temp Mode
