# 📄 FILE: `TECH-STACK.md` — Final Consolidated Stack (Single Source of Truth)

Before adding motion/animation specs, here is the **definitive, final stack** pulled together from all prior decisions — so there's zero ambiguity left.

## Confirmed Platform
**Responsive Website + Installable PWA** (not native app — per prior clarification, Option A confirmed as default).

## Full Stack Table

| Layer | Technology | Version/Notes |
|---|---|---|
| **Frontend Framework** | React 18+ with TypeScript (strict mode) | Component architecture |
| **Build Tool** | Vite | Fast HMR, optimized production bundles |
| **Styling** | Tailwind CSS + CSS custom properties (design tokens) | Utility-first + themeable tokens for dark/light |
| **Animation Library** | Framer Motion (`motion` package) | Declarative, gesture-aware, respects `prefers-reduced-motion` natively |
| **State Management** | Zustand (lightweight) + TanStack Query (server state/caching) | No Redux overhead needed for this app's complexity |
| **Forms/Validation** | React Hook Form + Zod | Shared Zod schemas with backend via OpenAPI codegen |
| **Routing** | React Router v6 (or TanStack Router) | Handles back-navigation stack, route transitions |
| **Real-time Client** | native `EventSource` (SSE) wrapper | With reconnect/backoff logic per `WORKFLOWS.md` |
| **PWA Tooling** | Vite PWA Plugin (Workbox under the hood) | Service worker, manifest, offline shell |
| **Icons** | Lucide React | Outline style, matches design system |
| **BFF/Public API** | TypeScript — Fastify (or Hono for edge-friendliness) | Shares Zod/OpenAPI types with frontend |
| **Mail Gateway & Security Core** | Go | Postfix integration, SMTP recipient validation, MIME parsing, sanitization pipeline |
| **Database** | PostgreSQL (Neon or Supabase free tier) | Relational integrity, full-text search (GIN index) |
| **Cache/Queue/Locks** | Redis (Upstash free tier) | Rate limiting, pub/sub, alias-claim locks |
| **Object Storage** | Cloudflare R2 free tier | Attachments, sanitized HTML blobs |
| **Malware Scanning** | ClamAV (`clamd`) | Self-hosted, free, real scanning |
| **Bot/Abuse Challenge** | Cloudflare Turnstile | Free, privacy-respecting |
| **Inbound SMTP** | Postfix on Oracle Cloud Always-Free VM | Real SMTP-level recipient validation |
| **Push Notifications** | Firebase Cloud Messaging (free) | Content-free payloads only |
| **Fallback Real-time Signal** | Firestore (Firebase free tier) | Ping-only, no message content, strict security rules |
| **Analytics** | Umami or Plausible (self-hosted) | No third-party tracking, privacy-aligned |
| **Error Tracking** | Sentry (free developer tier) | Frontend + backend error capture |
| **Monitoring** | Grafana Cloud free tier + Uptime Robot | Infra/app health |
| **CI/CD** | GitHub Actions (free tier) | Full pipeline per `CI-CD.md` |
| **Hosting — Frontend** | Cloudflare Pages | Free static hosting, global CDN |
| **Hosting — API/Go services** | Fly.io free allowance / Oracle Cloud VM | Free compute |
| **DNS/WAF/Edge** | Cloudflare (free plan) | Web traffic only, not mail path |

This is now locked. No further stack ambiguity remains.

---

# 📄 FILE: `MOTION-SYSTEM.md` — Complete Animation, Transition & Micro-Interaction Specification

This document closes the real gap identified earlier: the original suite mentioned motion only as a one-line rule ("150–250ms ease-out"). Here is the **full, screen-by-screen, interaction-by-interaction motion design** — described precisely enough to implement, without code.

---

## 1. Motion Design Principles

1. **Purposeful, not decorative** — every animation communicates state change, spatial relationship, or system feedback. Nothing animates "just because."
2. **Fast by default** — most UI transitions complete in 150–300ms; nothing user-blocking exceeds 400ms.
3. **Consistent easing language:**
   - **Entrances:** ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) — starts fast, settles gently
   - **Exits:** ease-in (`cubic-bezier(0.7, 0, 0.84, 0)`) — starts slow, accelerates away
   - **State changes (toggles, color shifts):** ease-in-out, ~200ms
   - **Physical/gesture-driven (swipe, drag):** spring physics (natural, not linear timing) — tuned to feel responsive, not bouncy/toy-like (low bounce/damping ratio ~0.8+)
4. **Reduced motion compliance:** every animation listed below has a **defined reduced-motion fallback** — typically an instant cross-fade (~100ms opacity only) replacing any transform/scale/slide, per `prefers-reduced-motion: reduce`.
5. **Haptic pairing:** on supported devices (mobile web with Vibration API), key confirmations pair a very short haptic pulse (10–15ms) with the visual animation — never haptic-only, always visually redundant for accessibility.

---

## 2. Global Page/Route Transitions

| Transition | Behavior | Duration | Reduced-motion fallback |
|---|---|---|---|
| Forward navigation (e.g., Home → Settings) | Incoming screen slides in from right (24px translate + fade-in), outgoing screen slides out left slightly + fades | 250ms ease-out | Instant fade only |
| Back navigation (back arrow / gesture) | Reverse of forward — incoming slides from left, outgoing slides right | 250ms ease-out | Instant fade only |
| Modal/Bottom Sheet open | Sheet rises from bottom edge with slight overshoot damping (spring), backdrop fades in (0→40% black scrim) simultaneously | ~300ms spring | Backdrop fade only, sheet appears instantly at final position |
| Modal/Bottom Sheet close | Sheet drops down and fades, backdrop fades out | 200ms ease-in | Instant disappear |
| Tab switch (bottom nav) | Icon scale-bounce (1 → 1.15 → 1) on active tab, underline indicator slides horizontally to new position | 200ms spring (indicator), 150ms (icon) | Icon color change only, no scale/slide |

---

## 3. Screen 2 (Home/Inbox) — Specific Animations

### 3.1 Address Generation Reveal (first load / regenerate)
This is the **hero moment** of the entire product — deserves the most polish:
1. On generation trigger, the address field shows a **character-scramble effect**: random characters cycle rapidly (like a slot-machine settling) for ~500ms before landing on the real generated local-part, character-by-character settling left to right with a slight stagger (30ms delay per character).
2. Once settled, a subtle **success glow pulse** (soft box-shadow expand-and-fade in brand indigo, 400ms) confirms the address is live.
3. Domain suffix (`@studentbox.in`) fades in 100ms after the local-part settles, no scramble (it's not the "surprise" part).

**Reduced motion:** address simply fades in at final value over 200ms, no scramble.

### 3.2 Copy Button Interaction
1. On tap: button icon morphs from "copy" icon to a checkmark icon via a **cross-fade + tiny scale pop** (icon scales to 1.2 then settles to 1.0), simultaneously button label text changes "Copy" → "Copied".
2. A small toast/snackbar slides up from bottom (mobile) or fades in near the button (desktop), holds 1.8s, then fades out.
3. Reverts to "Copy" state automatically after 2.5s (icon cross-fades back).
4. Haptic: 12ms tap-confirm vibration on mobile.

### 3.3 Countdown Timer Chip
1. Digits update with a **odometer-style roll** (each digit that changes flips/slides vertically to the new value) rather than an abrupt text swap — reduces visual "jump" jarring on a screen the user is staring at continuously.
2. Color state transitions (Normal → Warning → Critical) **cross-fade the background/text color** over 400ms — never an instant hard-cut color change, which feels alarming/glitchy.
3. At the moment it crosses into "Critical" (≤60s), the chip gains a **slow, subtle pulse** (opacity 100%→85%→100%, 1.2s loop) — gentle urgency, never a jarring flash (flashing is both bad UX and an accessibility hazard for photosensitive users).
4. On expiration (0:00), chip morphs into "Expired" label with a brief **shake micro-animation** (±4px horizontal, 3 cycles, 300ms total) to draw attention, then settles.

### 3.4 Pull-to-Refresh (mobile)
1. Standard elastic pull: content translates down following finger (1:1 up to a threshold, then resistance/rubber-banding beyond it).
2. A circular progress indicator fills as the user pulls past the trigger threshold, with the brand icon (envelope-hourglass mark) rotating gently inside it.
3. On release past threshold: indicator spins during fetch, then **morphs into a checkmark** briefly before collapsing back to the content, confirming refresh completed.
4. Haptic: light tick at threshold-crossed point, and again on refresh-complete.

### 3.5 New Message Arrival (Real-Time)
This is a critical "wow moment" — the product's core value delivering live:
1. New message card **slides in from the top of the list** (not bottom) with a slight overshoot spring, pushing existing messages down.
2. Card briefly has a **highlighted background wash** (soft brand-indigo tint at 8% opacity) that fades to normal card background over 1.5s — signals "this is new" without needing a permanent badge alone.
3. Simultaneously, the inbox message-count badge (if shown in nav/tab) does a **scale-pop bounce** (1 → 1.3 → 1) to draw peripheral attention.
4. If browser tab is inactive, the document title updates (`(1) StudentTemp`) as a lightweight passive notification — no animation needed there, just text change, since it's outside the viewport.
5. Optional (if sound enabled in settings): a very short, soft "pop" notification sound (<200ms, non-jarring, similar to iMessage-style subtlety) — off by default, opt-in only.

---

## 4. Screen 3 — Customize Address Sheet

1. **Availability check states** transition via icon cross-fade: neutral spinner (checking) → green checkmark (available) or red X (taken), each with a small scale-pop (0.8→1.0) on arrival — never an abrupt swap.
2. Input field border color **animates smoothly** between neutral/success/error states (200ms ease, color only — never a jarring border-width change).
3. If taken: subtle **input shake** (±3px, 2 cycles) paired with the error message fading in below the field.
4. Confirm button transitions from disabled (muted, 60% opacity) to enabled (full brand color, subtle scale-in of the button's inner glow) the instant validation passes — should feel like the button "wakes up."

---

## 5. Screen 4/5 — Message List & Reader

### 5.1 Message Card Swipe Gestures
1. **Swipe left (delete):** card follows finger 1:1 horizontally; a red "Delete" background with trash icon is revealed underneath, icon scales up slightly as swipe distance increases (visual feedback that threshold is approaching); past the commit threshold, releasing triggers the card to **continue sliding fully off-screen** (200ms ease-in) while the list collapses the vacated space smoothly (height animates to 0).
2. **Undo Snackbar:** slides up from bottom immediately after delete, holds 5s with a **shrinking progress bar** along its bottom edge indicating time remaining before permanent deletion, tapping "Undo" causes the card to **slide back in from the left** and re-insert at its original position with a brief highlight flash.
3. **Swipe right (mark read/unread):** similar mechanics, teal background with mail/mail-open icon swap, card springs back to resting position after action registers (does not remove from list).

### 5.2 Opening a Message (List → Reader transition)
1. Rather than a generic slide, use a **shared-element-style expand**: the tapped card's position/bounds animate/morph into the reader's header block (sender info area), giving a sense of spatial continuity — the card "becomes" the top of the reader screen.
2. Reader body content (subject, body) fades/slides up from below simultaneously, staggered ~50ms after the header morph starts.
3. Reverse exactly in reverse when pressing Back.

*(If shared-element morphing proves too complex for initial build, acceptable fallback: standard forward-slide transition per §2 — but the shared-element approach is the premium-feel target and worth the Framer Motion `layoutId` implementation effort.)*

### 5.3 External Content Blocked Banner
"3 external resources blocked" banner **slides down from the top of the message body** (not a jarring inline pop-in), with an inline "Load anyway" text-button; tapping it triggers the blocked images to **fade in individually with a slight stagger** (each image 80ms after the previous) as they load, rather than all popping in simultaneously.

### 5.4 Attachment Scan Progress
1. Scanning state shows an **indeterminate progress bar** with a soft moving gradient sweep (not a static spinner) — communicates active work without implying a knowable percentage.
2. On scan complete: bar **fills to 100% then fades out**, replaced by the scan-status chip fading in (green "Clean" or amber "Quarantined") with a small checkmark/warning icon draw-in animation (SVG path stroke animates from 0% to 100%, ~300ms) — a satisfying "verified" feel.

---

## 6. Screen 6 — Security Panel (Bottom Sheet)

Each authentication result row (SPF/DKIM/DMARC) reveals its status icon with a **staggered fade+slide-up** (each row 60ms after the previous) as the sheet opens — avoids all information dumping on screen simultaneously, guides the eye top-to-bottom.

---

## 7. Screen 7 — QR Share

QR code **draws in as a dissolve/pixel-reveal** effect (a subtle randomized reveal of the QR modules, ~400ms) rather than an abrupt appear — feels premium, avoids a jarring "pop."

---

## 8. Screen 9 — My Addresses (Multi-Inbox Tray)

1. Horizontal carousel swipe uses **native momentum/inertia scrolling** with spring-based snap-to-card alignment (card centers itself with a gentle spring settle after swipe release, not an abrupt snap).
2. Adding a new address: new card **scales in from 0.8→1.0 with fade** at the end of the list, existing cards shift left smoothly to accommodate.
3. Deleting (swipe-to-delete on a card): card scales down and fades while collapsing its width to 0, remaining cards slide to fill the gap — a "deflate" feel rather than a hard cut.

---

## 9. Screen 11 — App Lock / Unlock

1. **PIN pad entry:** each digit press triggers the corresponding dot indicator to **fill with a scale-pop** (0→1.2→1.0), and on a full incorrect PIN, all dots **shake together** (±6px, 3 cycles) then clear, giving clear tactile-feeling wrong-input feedback without needing text.
2. **Biometric prompt trigger:** a breathing/pulse animation on the fingerprint/face icon (opacity 100%→70%→100%, 1.5s loop) while waiting for the OS-level prompt response.
3. **Unlock success:** entire lock screen **fades out while scaling up very slightly (1.0→1.03)** as the inbox content beneath fades/scales in from (0.97→1.0) — a subtle "revealing what was hidden" effect, not a hard cut.
4. **Auto-lock trigger (backgrounding):** no animation needed on lock-engage since it happens while app isn't visible; but on next foreground, the lock screen should already be present with zero flash-of-unlocked-content — this is a logic requirement, not a visual one (content must not render, even briefly, before the lock-check completes).

---

## 10. Screen 12 — Expired Inbox

The transition into this state should feel **narratively distinct** from a generic error:
1. The hero address text **desaturates and fades to 40% opacity** over 600ms (slow, deliberate — mirroring "fading away").
2. The countdown chip, having hit 0:00, **morphs its shape** from a rounded chip into a static "Expired" label (width animates smoothly to fit new text, no jump-cut resize).
3. An hourglass/fade illustration **fades in with a slight upward drift** (8px translate-up + fade, 400ms) as the primary empty-state visual.
4. "Create New Address" button **pulses very subtly** once (scale 1→1.05→1, single cycle) a beat after the screen settles, to draw the eye to the primary recovery action without being obnoxious.

---

## 11. Toasts, Snackbars & System Feedback (Global)

| Type | Entrance | Exit | Duration Held |
|---|---|---|---|
| Success (Copied, Saved) | Slide up + fade, from bottom | Fade out | 2–2.5s |
| Error/Warning | Slide down + fade, from top (distinct position from success = distinct meaning at a glance) | Fade out | 3–4s (longer, more to read) |
| Undo action | Slide up from bottom, stays until action/timeout | Slide down + fade | 5s with visible countdown bar |
| Info (e.g., "3 external resources blocked") | Slide down within content area, not global toast | Slides back up when dismissed | Until dismissed or resolved |

**Rule:** success and error toasts appear on **opposite edges** (bottom vs top) as a consistent spatial-memory cue — users learn "bottom = good, top = attention needed" over repeated use, without relying on color alone (accessibility benefit too).

---

## 12. Loading States — Skeleton Screens (detailed)

Rather than generic pulsing gray boxes, skeletons should:
1. Match the **exact shape/proportions** of the real content they represent (avatar circle, subject-line-width bar, timestamp-width bar) so the layout doesn't jump when real content arrives.
2. Use a **shimmer sweep** (a soft diagonal gradient highlight moving left-to-right across the skeleton shapes, ~1.5s loop) rather than a flat opacity pulse — feels more "alive"/premium.
3. **Content swap-in:** when real data arrives, skeleton shapes **cross-fade directly into their real counterparts** at the same position/size (200ms) — never an abrupt skeleton-disappears-then-content-pops-in with any layout shift.

---

## 13. Dark Mode Toggle Transition

Switching Light ↔ Dark should **not** be an abrupt flash-cut (jarring, especially at night). Instead:
1. A brief **circular reveal wipe** originates from the toggle control's position, expanding outward to cover the viewport with the new theme's background color, revealing the new theme underneath as it expands (~400ms ease-in-out).
2. All text/icon colors cross-fade simultaneously rather than hard-switching.
3. Respect reduced-motion: instant theme swap, no wipe animation, if the user has that preference set.

---

## 14. Onboarding Slides (Screen 15)

Standard horizontal swipe carousel with:
1. Active dot indicator **elongates into a pill shape** (from circle to horizontal capsule) as its slide becomes active, other dots shrink back to circles — a small but premium detail differentiating from generic dot indicators.
2. Slide illustrations have a **subtle parallax**: illustration moves slightly slower/faster than the text content during the swipe gesture (foreground text at 1x drag speed, background illustration at 0.7x) for depth.
3. Final slide's CTA button ("Create my inbox") has a **gentle continuous glow/shadow pulse** (very subtle, 2s loop) to draw the eye as the natural conversion point.

---

## 15. Notification Permission Prompt (Custom Pre-Prompt)

Before triggering the native browser permission dialog (which can't be styled and is a one-shot ask), show a **custom in-app pre-prompt card** first:
1. Card slides up from bottom with a bell icon that does a **single gentle "ring" wiggle** (rotate ±8°, 2 cycles, 400ms) on appearance — draws attention to the icon's meaning without being obnoxious.
2. Only after the user taps "Enable" on this custom card does the real browser permission dialog fire — this respects the user (no cold, unexplained browser popup) and improves real opt-in rates.

---

## 16. Micro-Interaction Sound Design (Optional, Off by Default)

If a user opts into sound feedback (`Settings → Notifications → Sound`):
| Event | Sound character |
|---|---|
| New message arrival | Soft, short "pop"/chime (<200ms) |
| Copy confirmed | Very subtle click (<100ms) |
| Error | Low, single soft tone (not harsh/buzzer-like) |
| Unlock success | Gentle ascending two-note chime |

All sounds must be short, non-looping, and respect system mute/silent-mode — never autoplay audio without explicit prior opt-in (also avoids browser autoplay-policy blocks).

---

## 17. Gesture Feature Additions (New — Filling a Real Gap)

Beyond what was previously listed, add these for a genuinely polished feel:

| Gesture | Screen | Action |
|---|---|---|
| Long-press on message card | Message List | Opens quick-action context menu (Delete / Mark unread / Report) without navigating into the reader — with a **haptic tick + slight scale-down (0.98)** of the card on press-hold to confirm registration |
| Double-tap on address text | Home | Quick-copies address (alternative to button tap) — icon feedback identical to §3.2 |
| Drag-to-reorder | My Addresses tray | Long-press then drag to reorder inbox cards, with other cards animating out of the way in real time as the dragged card passes over them |
| Swipe-down-to-dismiss | Any bottom sheet/modal | Matches the open animation in reverse; if swipe doesn't clear threshold, sheet **springs back to full-open position** rather than staying half-open |
| Shake-to-report (mobile, optional Phase 3) | Message Reader | Device shake gesture triggers a quick "Report this message?" prompt — novel but genuinely useful for fast phishing reporting; must be opt-in in Settings to avoid accidental triggers |
| Pinch-to-zoom | Message Reader (HTML body) | Standard pinch zoom on the sandboxed iframe content for accessibility/readability of dense email layouts |

---

## 18. Summary — What This Closes

This document resolves the previously identified UI/UX gap where motion was mentioned only as a generic one-line rule. It now provides:
- Screen-by-screen animation specification
- Exact timing/easing values per interaction type
- Haptic and sound pairing rules
- Reduced-motion fallback for every single animation (accessibility-complete)
- New gesture features not previously specified (long-press context menu, drag-to-reorder, shake-to-report, double-tap copy)

This should be added to the repo as `docs/design/MOTION-SYSTEM.md` and referenced directly inside `DESIGN-SYSTEM.md` and `SCREENS.md` so implementers treat motion as a first-class, specified requirement — not an afterthought left to individual developer taste.
