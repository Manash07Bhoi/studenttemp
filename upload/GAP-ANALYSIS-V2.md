# 📄 FILE: `GAP-ANALYSIS-V2.md` — Gmail Feature Parity Audit + Mail Tracking + Cross-Provider Send Verification

I did a hard, literal feature-by-feature comparison against real Gmail functionality, plus a dedicated audit of the newly requested "mail tracker" and "send-to-real-Gmail" capability. Here's everything still missing, with fixes.

---

## PART 1 — Missing Gmail-Class Features (Not Previously Covered)

### G1. Conversation/Thread View
Gmail groups related messages (replies) into a single expandable thread — not a flat message list. This was completely absent.

**Fix — New table + logic:**
```
threads
-------
id, account_id, subject_normalized, participant_addresses (jsonb),
last_message_at, message_count, has_unread, labels (via message_labels rollup)
```
**Threading logic:**
```
ON NEW MESSAGE (inbound or outbound) ARRIVES
├─ Extract References/In-Reply-To headers (standard email threading headers)
├─ IF a matching thread exists (via Message-ID chain OR normalized
│     subject + participant match within a time window) 
│     → append message to existing thread, bump last_message_at,
│       increment message_count
├─ ELSE → create new thread with this message as root
└─ Thread list UI shows: sender(s), subject, snippet of latest
      message, count badge ("4") if multiple messages, expand
      on tap to reveal full conversation stacked chronologically
```
**UI addition:** Screen A3 (Account Home) message rows must show thread count badges; Screen A4 gets a "Reply/Reply All/Forward" set of actions that append to the thread rather than always composing fresh.

### G2. Reply / Reply All / Forward (was completely missing)
**Fix — New conditional logic:**
```
ON TAP REPLY
├─ Pre-fill To = original sender only
├─ Pre-fill Subject = "Re: " + original subject (no duplicate "Re: Re:")
├─ Quote original message body below a divider, collapsed by
│     default ("Show quoted text" toggle)
ON TAP REPLY ALL
├─ Pre-fill To = original sender, Cc = all other original
│     recipients EXCEPT the current user's own address
ON TAP FORWARD
├─ Subject = "Fwd: " + original subject
├─ Body = empty compose area + full quoted original below
├─ Attachments from original message carried forward automatically
├─ To field empty, cursor focused there
```

### G3. Push/IMAP/POP3 Access (Missing Entirely)
Gmail allows third-party mail clients (Outlook, Apple Mail, Thunderbird) to connect via IMAP/POP3/SMTP. Zero mention anywhere in prior docs.

**Fix — Add as Phase 3 Account Mode feature:**
- Add IMAP server capability (Go-based, e.g., using `go-imap` library) alongside the existing SMTP receiver
- Settings screen addition: "Forwarding and POP/IMAP" tab — enable/disable IMAP access, generate app-specific passwords (never expose the main account password to third-party clients — **App Passwords** pattern, exactly like real Gmail)
- **Conditional logic:**
```
ON THIRD-PARTY CLIENT LOGIN ATTEMPT (IMAP/SMTP)
├─ IF using main account password directly → REJECT
│     (force use of App Password only, main password reserved
│      for web login + sensitive actions)
├─ IF App Password valid AND not revoked → grant scoped access
│     (mail read/send only, cannot change account settings,
│      cannot change password, cannot disable 2FA)
└─ Log this as a distinct "device/app" entry in Security Settings
      (Screen A8) so the user can see and revoke it individually
```

### G4. Confidential Mode (Missing)
Gmail lets senders set an expiration date and passcode-via-SMS on sent messages, disable forward/copy/print/download.

**Fix — Add to Compose (Screen A4):**
- Toggle "Confidential Mode" → set expiry (1 day–5 years) and optional SMS passcode requirement
- **Logic:** message body/attachments are NOT delivered inline to non-StudentTemp recipients; instead, recipient gets a link that renders the content in a controlled viewer (download/forward/print/copy disabled via UI controls + no attachment download endpoint exposed), and the link stops resolving after the set expiry regardless of whether it was opened.
- **Honesty caveat required in UI:** exactly like real Gmail, disclose: *"Confidential Mode helps prevent accidental sharing but doesn't stop recipients from taking screenshots or photos."* — never overclaim security here.

### G5. Smart Compose / Smart Reply (Missing)
Not mandatory for MVP, but flag explicitly: **do not fake this with hardcoded suggestion strings.** If implemented, it requires a real lightweight suggestion model or a genuine third-party API — otherwise **omit the feature entirely** rather than presenting fake "AI suggestions," which would directly violate `AGENT.md`'s anti-fake-logic rule.

**Fix:** Mark explicitly as **Phase 4, optional, requires a real inference service** — not included in MVP/Phase 2/3 scope.

### G6. Nested/Sub-Labels (Missing)
Gmail supports parent/child labels (`Work/Projects/ClientA`).

**Fix:** Add `parent_label_id` (nullable, self-referencing FK) to the `labels` table; UI renders as an expandable tree in the label sidebar (Screen A5).

### G7. "Mute Conversation" (Missing)
Archives current and all future replies in a thread without marking as read individually.

**Fix — logic:**
```
ON MUTE THREAD
├─ Move thread out of Inbox view immediately
├─ FOR ALL FUTURE messages arriving into this thread
│     → skip Inbox placement, file directly to All Mail,
│       do NOT trigger new-message notification/badge
└─ Muting is reversible via "Unmute" from All Mail/thread view
```

### G8. Priority Inbox / Importance Markers (Missing)
Gmail auto-flags "Important" mail using a heuristic (sender history, keywords, direct-to-you vs bulk).

**Fix — Add importance classifier logic (rule-based, not fake-AI):**
```
MESSAGE IMPORTANCE SCORE CALCULATED FROM REAL SIGNALS
├─ +weight if sender is in user's Contacts
├─ +weight if user has replied to this sender historically
│     (real query against sent_messages/threads)
├─ +weight if user's address is in To: (not Cc/Bcc, not a
│     mailing-list header)
├─ -weight if bulk headers present (List-Unsubscribe, etc.)
├─ -weight if classified into Promotions/Social already
└─ Score above threshold → tag "Important" marker (yellow
      arrow icon, matches Gmail convention), shown in Inbox
```
This is genuinely computable from real data — not a fabricated "AI" claim.

### G9. Signature with Multiple Profiles / Send-As Aliases (Partially Missing)
Previously added basic aliases table, but missing: per-alias signature, per-alias "reply from same address it was sent to" logic.

**Fix — logic:**
```
ON REPLY to a message that was originally sent to an ALIAS
     address (not the primary permanent address)
├─ Default "From" field on the reply = that alias, not the
│     primary address (matches real Gmail send-as behavior)
└─ Signature auto-inserted matches the alias's configured
      signature, not the account's default one
```

### G10. Spam/Phishing Auto-Detection Heuristics (Was Only "Spam folder exists," logic missing)
**Fix — add explicit rule-based spam scoring pipeline (already partially covered by the mail-processor's `spam_score` column, but logic never specified):**
```
INCOMING MESSAGE SPAM EVALUATION
├─ SPF/DKIM/DMARC all fail → +high score
├─ Sender domain on a known DNSBL → +high score
├─ Message contains excessive links + urgency keywords
│     ("verify now," "account suspended," etc., basic real
│      heuristic list, not fabricated AI) → +medium score
├─ Sender previously marked as Spam by this user → auto-spam,
│     skip further scoring
├─ Score > threshold → file to Spam, do not notify
├─ Score borderline → file to Inbox but show a real, visible
│     warning banner ("This message looks suspicious") — never
│     silently let a border-line message through with no signal
└─ Score low → normal Inbox/category placement
```

### G11. "Undo Archive/Delete/Label" (only Undo Send was specified)
**Fix:** Every destructive/state-changing action (Archive, Delete, Label-apply, Mark-as-read) gets the same Snackbar-with-Undo pattern already designed for message-delete in Temp Mode — apply this consistently across all of Account Mode's bulk actions too (select multiple → bulk archive/delete/label, each reversible for 5–8 seconds).

### G12. Bulk/Multi-Select Actions (Missing)
Gmail allows checkbox multi-select for bulk archive/delete/label/mark-read.

**Fix — add to Screen A3:** long-press (mobile) or checkbox-on-hover (desktop) enters multi-select mode, top bar changes to show count + bulk action icons (Archive/Delete/Label/Mark read/Snooze), "Select all in this label," "Select all matching this search."

### G13. Print Message (Missing, minor but real Gmail feature)
**Fix:** Add "Print" action to message reader — generates a clean, sanitized print-friendly view (strips navigation chrome, keeps sender/subject/date/body only).

### G14. Keyboard Shortcuts Table Never Actually Enumerated
Listed as a bullet ("✅ Keyboard shortcuts") with zero specification.

**Fix — Minimum required shortcut set (desktop only):**
| Key | Action |
|---|---|
| `c` | Compose |
| `r` / `a` / `f` | Reply / Reply All / Forward |
| `e` | Archive |
| `#` | Delete |
| `s` | Star/unstar |
| `u` | Mark unread |
| `/` | Focus search |
| `j` / `k` | Next/previous message in list |
| `Esc` | Close compose/reader |
| `?` | Show shortcut help overlay |

---

## PART 2 — Missing Conditional Logic (General Gaps, Beyond Gmail Parity)

### L1. What happens on simultaneous Temp Mode expiry + active SSE connection?
Never specified what the client does if a message-fetch is in-flight exactly as expiry hits.

**Fix:**
```
INBOX EXPIRES WHILE A REQUEST IS IN-FLIGHT
├─ Server rejects the in-flight request with a specific
│     "INBOX_EXPIRED" error code (not a generic 404/500)
├─ Client, on receiving this specific code, transitions
│     directly to the Expired screen rather than showing a
│     generic error+retry (retry would be pointless here)
```

### L2. What happens if a user has App Lock enabled AND a deep-link notification tap occurs while locked?
**Fix:**
```
NOTIFICATION TAPPED WHILE APP LOCK ENGAGED
├─ Lock screen is shown FIRST, deep-link target is stored
│     in a pending-navigation variable, NOT navigated to yet
├─ ON successful unlock → THEN navigate to the originally
│     intended deep-linked message
├─ ON failed/abandoned unlock → pending navigation discarded,
│     user lands on default Home once eventually unlocked
```

### L3. What happens if two Account Mode filters both say "Delete" but one also says "Forward to X"?
Previously only said "longest retention wins" for labels; filters conflict logic was unaddressed.

**Fix:**
```
FILTER ACTION CONFLICT RESOLUTION
├─ "Forward" actions always execute regardless of later
│     "Delete" actions in the chain (forwarding a copy before
│     deletion is the expected real-world behavior)
├─ "Delete" as an action halts further filter evaluation
│     immediately after any pending Forward completes
├─ Multiple "Apply label" actions from different matching
│     filters are all additive (a message can carry several
│     labels from several filters simultaneously)
```

### L4. Custom alias cooldown ledger — what if the SAME session tries to reclaim their own just-expired alias?
**Fix:**
```
ALIAS RECLAIM CHECK
├─ IF requesting session's hash MATCHES the
│     last_used_by_session_hash on the cooldown ledger
│     → allow immediate reclaim, skip cooldown
│       (it's the same person, not a hijack attempt)
├─ ELSE → enforce full cooldown window before availability
```
This was actually a real functional gap — the anti-squatting design would have wrongly punished legitimate returning users.

### L5. What if a user deletes their Account while Vacation Responder is active, or while they have scheduled sends pending?
**Fix:**
```
ON ACCOUNT DELETION REQUESTED
├─ Cancel all pending Scheduled Sends immediately (never fire
│     mail after account deletion)
├─ Disable Vacation Responder immediately
├─ Revoke all App Passwords / IMAP sessions / active login
│     sessions instantly
├─ Enter a grace-deletion window (e.g., 14 days, soft-deleted,
│     recoverable via re-login) BEFORE permanent purge —
│     document this clearly in the deletion confirmation UI
│     ("Your account will be permanently deleted in 14 days
│      unless you sign back in")
├─ On grace window expiry → real, permanent, irreversible
│     purge of mail, attachments, contacts, and metadata
```
This was entirely unaddressed — "Delete Account" existed as a button with no actual lifecycle behind it.

---

## PART 3 — Mail Tracking: Delivery, Sent, Received, Seen/Read Status

This is a **real, buildable feature** — but it must be built honestly, respecting the difference between what you can *actually* verify versus what you can only *infer*. This is important because over-claiming tracking accuracy (especially "read receipts") is both a technical impossibility in many cases and a genuine privacy/ethics issue that needs explicit UI honesty.

### T1. What Can Be Genuinely Tracked (Real, Verifiable Signals)

| Status | How It's Actually Determined | Reliability |
|---|---|---|
| **Sent** | Your outbound relay (Resend/Brevo) accepted the message from your server | 100% reliable — you control this |
| **Delivered** | Relay provider's webhook confirms the receiving server accepted it (SMTP 250 response captured by the relay) | High reliability — relay providers expose delivery webhooks |
| **Bounced** | Relay webhook reports hard/soft bounce | High reliability |
| **Opened / Seen** | Tracking pixel (1x1 transparent image) embedded in outbound HTML mail, loaded when recipient's client renders remote images | **Unreliable by design** — many clients (Gmail by default, Apple Mail Privacy Protection, Outlook with image-blocking) block or pre-fetch pixels, causing false positives/negatives |
| **Read (explicit)** | Only possible if recipient's client honors a formal **read-receipt request** (`Disposition-Notification-To` header, MDN — RFC 8098) and the recipient explicitly agrees to send one | **Very unreliable** — most modern clients ignore or prompt-and-often-decline this; **Gmail does not support sending/honoring MDN read receipts for regular consumer accounts** at all |

### T2. Correct, Honest Implementation Plan

```
sent_messages (extended)
------------------------
id, account_id, to, subject, sent_at, relay_provider,
relay_message_id, status ('queued','sent','delivered',
'bounced','failed'),
delivered_at, bounced_at, bounce_reason,
tracking_pixel_id (nullable), first_opened_at (nullable),
open_count (int), mdn_requested (bool), mdn_received_at (nullable)
```

**Delivery/Bounce Tracking — Fully Real, No Guesswork:**
```
ON OUTBOUND SEND
├─ Server calls relay provider API (Resend/Brevo) to send
├─ Store relay_message_id returned by the provider
├─ Relay provider sends a WEBHOOK to your backend on:
│     - delivered
│     - bounced (hard/soft)
│     - complained (marked as spam by recipient)
├─ Backend updates sent_messages.status accordingly in real time
├─ UI shows an honest status chip: "Sent" → "Delivered" →
│     (or "Bounced: mailbox full" with real bounce_reason text
│      from the provider, not a generic guess)
```

**Open/Seen Tracking — Implemented, But Labeled Honestly:**
```
ON COMPOSE, IF "Track when opened" enabled by sender (opt-in,
     NOT default-on — this has real privacy implications for
     the RECIPIENT, who never consented to being tracked)
├─ Embed a unique tracking pixel URL in the HTML body,
│     pointing to your own tracking endpoint
├─ IF recipient's client loads remote images
│     → your server logs a hit → first_opened_at set,
│       open_count incremented
├─ UI displays this status as "Seen" with a SMALL, HONEST
│     caveat icon/tooltip: "Based on image loading — may be
│     inaccurate or unavailable depending on the recipient's
│     email client"
├─ IF recipient's client blocks images (Gmail does this by
│     default via proxy-caching all images, which can actually
│     cause a FALSE "seen" the instant the message is merely
│     opened in preview, not necessarily truly read — this
│     must be disclosed) → UI never claims certainty
```

**Explicit Read Receipt (MDN, RFC 8098) — Implement But Expect Near-Zero Usage With Gmail Recipients:**
```
ON COMPOSE, sender optionally checks "Request read receipt"
├─ Server adds Disposition-Notification-To header to outbound mail
├─ IF recipient's mail client supports AND recipient manually
│     approves sending an MDN response (most clients prompt the
│     recipient, they can decline) → mdn_received_at is set,
│     UI shows a genuinely confirmed "Read" badge
├─ IMPORTANT REAL-WORLD CAVEAT (must be shown in UI copy when
│     this feature is used): "Gmail and many other providers do
│     not support delivery of read receipts to consumer accounts.
│     This feature may not work when emailing Gmail, Yahoo, or
│     other major providers."
└─ This must NEVER be silently omitted — overclaiming this
      capability against real Gmail recipients would be a
      direct violation of the "no fake logic/claims" rule
```

### T3. UI — Sent Mail Status Display (Screen A3 "Sent" label + Screen A4 confirmation)

Each sent message in the Sent list shows a **status pill chain**, not just one word:

```
[Sent] → [Delivered] → [Seen*] 
                          *tooltip: "Approximate, based on
                           image-loading signal"
```
or on failure:
```
[Sent] → [Bounced: Mailbox full] (red pill, tap for full
          bounce diagnostic message from the relay provider)
```

### T4. Inbound Side — "Delivery confirmation to the sender" (Read Receipt You're Asked to Send)

When StudentTemp Account Mode **receives** a message that requests a read receipt (`Disposition-Notification-To` header present):
```
ON MESSAGE OPENED THAT REQUESTS A READ RECEIPT
├─ Show a small, dismissible in-reader banner:
│     "The sender has requested a read receipt. Send one?"
│     [Send] [Decline] [Always decline for this sender]
├─ IF user taps Send → generate and dispatch a proper MDN
│     response message via the outbound relay
├─ IF user taps Decline or ignores → no MDN sent, ever,
│     silently (never auto-send without explicit consent —
│     this respects the RECEIVING user's privacy, mirroring
│     how real Gmail/Outlook handle this feature)
```

---

## PART 4 — "Use This Mail to Send Message to Google Gmail etc." — Clarification & Correct Implementation

Interpreting this literally: **the ability for a StudentTemp Account Mode address to send a real outbound email that successfully lands in an actual Gmail/Outlook/Yahoo inbox** (not spam-folder'd, not rejected).

This was partially covered (`PRD-ADDENDUM-ACCOUNTS.md` outbound relay decision) but the **deliverability engineering steps** were not detailed. Here they are, concretely:

### Step-by-Step Requirements to Actually Land in Gmail's Inbox (Not Spam)

1. **Never send directly from your own Postfix/Oracle VM IP for Account Mode outbound.** Use Resend or Brevo as decided — they maintain pre-warmed sending IP reputation pools.
2. **Configure your sending domain's authentication correctly at the DNS level** (this is mandatory, not optional):
   - SPF record authorizing the relay provider's sending servers
   - DKIM record (relay provider gives you the DKIM public key to publish) — every outbound message must be DKIM-signed
   - DMARC record with an actual enforcement policy (start with `p=none` for monitoring, graduate to `p=quarantine` then `p=reject` once you confirm legitimate mail always passes)
3. **Never send bulk/marketing-style content through the transactional relay tier** — mixing personal mail with bulk mail on the same sending domain damages reputation for both. If a "Promotions"/bulk feature is ever added, use a **separate subdomain** for it (e.g., `updates.studenttemp.example` vs `mail.studenttemp.example`) so reputation is isolated.
4. **List-Unsubscribe header** must be included on any bulk-style outbound mail (even transactional-adjacent) — Gmail specifically penalizes senders who don't support one-click unsubscribe as of their 2024 bulk sender requirements.
5. **Monitor Google Postmaster Tools** (free, official Google product) once sending volume to Gmail addresses is meaningful — this gives real, direct reputation/spam-rate feedback from Google itself, not a guess.
6. **Rate-ramp new sending domains gradually** — don't blast volume on day one even via a reputable relay; start low (tens/day), increase gradually over 2–4 weeks as positive engagement (opens, replies, no spam-complaints) accumulates.

**This entire step sequence must be added as a mandatory pre-launch task for Account Mode's outbound capability specifically — Temp Mode never sends outbound at all, so this only applies once Account Mode ships.**

---

## PART 5 — Updated Database Additions (Consolidated)

```
threads (new — see G1)
sent_messages (extended — see T2)
message_read_receipts_requested (new)
--------------------------------------
message_id, requested_by_sender (bool), responded (bool),
responded_at, declined (bool)

tracking_pixels
----------------
id, sent_message_id, unique_token, created_at,
first_hit_at, hit_count, last_hit_ip_hash

app_passwords
--------------
id, account_id, label (user-given name, e.g. "Thunderbird"),
password_hash, created_at, last_used_at, revoked (bool)

labels (extended)
------------------
+ parent_label_id (nullable, self-FK) — see G6
```

---

## PART 6 — Updated Checklist Additions

- [ ] Thread grouping tested — send a reply chain of 5+ messages, confirm they group into one thread correctly, including with a real external Gmail participant in the chain
- [ ] Reply/Reply All/Forward tested for correct recipient pre-fill and quoted-text behavior
- [ ] App Password flow tested with a real third-party IMAP client (e.g., Thunderbird) — confirm main password is rejected, App Password works, and it's individually revocable
- [ ] Confidential Mode tested — confirm recipient cannot download/forward, confirm link expires exactly at set time
- [ ] Importance/spam scoring tested against real varied sample mail (not synthetic obvious spam only) to confirm reasonable real-world accuracy
- [ ] Bulk multi-select actions tested (select 10+, archive, confirm undo works for the whole batch)
- [ ] **Delivery tracking tested against a real relay webhook** — send to a deliberately invalid address, confirm bounce webhook updates status correctly with real bounce reason text
- [ ] **Open tracking tested and explicitly confirmed to show the "approximate" disclaimer** — verify the UI never claims certainty
- [ ] **Read receipt (MDN) tested against a real Gmail recipient address specifically** — confirm the system correctly shows the "may not work with Gmail" caveat and does not silently fail without explanation
- [ ] Account deletion grace-period logic tested — confirm scheduled sends/vacation responder are actually halted immediately, and confirm real permanent purge after grace window in a test environment
- [ ] Alias cooldown reclaim-by-same-session logic tested explicitly (this was a real bug in the original design, now fixed per L4)
- [ ] Google Postmaster Tools connected and monitored before any meaningful Account Mode outbound volume goes live

---

## Summary

This pass closed **14 missing Gmail-class features** (threading, reply/forward, IMAP/App Passwords, Confidential Mode, nested labels, mute, importance markers, send-as signatures, spam heuristics, undo-everywhere, bulk actions, print, keyboard shortcuts, and explicit Smart-Compose exclusion), **5 missing conditional-logic edge cases** (mid-request expiry, locked+deep-link, filter conflicts, alias reclaim-by-owner, account-deletion cleanup), and delivered a **fully honest, technically-accurate mail tracking system** that clearly separates what's genuinely verifiable (sent/delivered/bounced via real relay webhooks) from what's inherently approximate (open/seen via pixel) and what's essentially non-functional against Gmail specifically (MDN read receipts) — with mandatory, non-hideable UI disclaimers everywhere accuracy is limited, and a concrete, real deliverability engineering checklist for actually landing mail in Gmail inboxes rather than spam folders.
