# StudentTemp — Project Worklog

## Project Overview
**StudentTemp** is a privacy-first temporary email platform built for students, developers, and testers.
Adapted from a detailed PRD to our Next.js 16 + Prisma + Socket.IO stack. The PRD specified
Vite/React/Go/Postgres, but we delivered an equivalent feature set on Next.js with SQLite + a
socket.io mini-service that simulates real SMTP receipt by generating realistic incoming mail
(OTP codes, registration confirmations, newsletters, social notifications, security alerts, etc.).

---

## Current Project Status (as of initial build completion)

### Architecture
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State**: Zustand (client) + TanStack Query (server) + Sonner (toasts)
- **Database**: Prisma + SQLite (`prisma/schema.prisma`) — models: Inbox, Message, AbuseReport, SessionSettings
- **Real-time**: Socket.IO mini-service on port 3003 (`mini-services/mail-service/`) with a mock
  email generator that produces realistic Indian-student-themed mail every ~12s for active inboxes
- **Gateway**: Caddy on port 81 proxies `?XTransformPort=3003` to the mail-service

### What's working (verified with agent-browser)
1. ✅ Page loads at `/` (HTTP 200, no hydration errors)
2. ✅ Inbox generation — random local-parts with character-scramble reveal animation
3. ✅ Countdown timer with odometer-style digit rolls + color states (normal → warning → critical → expired)
4. ✅ Copy-to-clipboard with icon morph (copy → check) + toast
5. ✅ Customize dialog — custom local-part with debounced real-time availability check + validation
6. ✅ QR share dialog with pixel-reveal animation
7. ✅ Extend-expiration (+10 min) and delete inbox
8. ✅ Real-time message delivery via Socket.IO through the Caddy gateway
9. ✅ Messages list with unread badges, category tags, hover quick-actions (star/read/delete/report)
10. ✅ Message reader: subject, sender, HTML body in sandboxed iframe, external-resource block banner,
    SPF/DKIM/DMARC auth panel, attachments, plain-text toggle, report-abuse flow
11. ✅ My Addresses tray — multi-inbox cards with quota bar (5 max), switch/copy/extend/delete
12. ✅ Settings — defaults (lifetime/domain), notifications (sound/reduce-motion/compact/burn-on-read),
    data export (JSON), clear-all-inboxes, FAQ accordion. Persisted to localStorage.
13. ✅ About section — hero, features grid, how-it-works timeline, privacy model, FAQ, CTA
14. ✅ Dark/light/system theme with circular-reveal transition
15. ✅ Mobile-responsive nav (horizontal scroll on mobile, full nav on desktop)
16. ✅ Sticky footer that sits at bottom on short pages and pushes down on long pages

### File structure
```
prisma/schema.prisma                     # Inbox, Message, AbuseReport, SessionSettings
src/lib/db.ts                            # Prisma client (singleton)
src/lib/mail-utils.ts                    # domains, generation, validation, session
src/lib/api-client.ts                    # typed fetch wrappers
src/lib/types.ts                         # shared TS types
src/lib/store.ts                         # Zustand store
src/hooks/use-socket.ts                  # Socket.IO connection hook
src/app/api/domains/route.ts
src/app/api/inboxes/route.ts            # GET list, POST create
src/app/api/inboxes/[id]/route.ts       # GET, DELETE, PATCH (extend)
src/app/api/inboxes/[id]/messages/route.ts
src/app/api/inboxes/[id]/generate/route.ts
src/app/api/messages/[id]/route.ts      # GET (full body), PATCH (read/star), DELETE
src/app/api/messages/[id]/report/route.ts
src/app/api/check-alias/route.ts
src/app/api/stats/route.ts
src/app/layout.tsx                       # ThemeProvider + QueryProvider + Toaster
src/app/page.tsx                         # renders <AppShell/>
src/app/globals.css                      # emerald/teal brand theme, animations
src/components/app-shell.tsx             # main layout, nav, socket orchestration
src/components/theme-provider.tsx
src/components/theme-toggle.tsx          # circular-reveal theme switch
src/components/countdown-timer.tsx       # odometer digit rolls + color states
src/components/scramble-text.tsx         # slot-machine character scramble
src/components/qr-code.tsx               # pixel-reveal dissolve
src/components/sections/inbox-section.tsx
src/components/sections/messages-section.tsx
src/components/sections/addresses-section.tsx
src/components/sections/settings-section.tsx
src/components/sections/about-section.tsx
mini-services/mail-service/index.ts      # Socket.IO + generation loop + expiry sweep
mini-services/mail-service/content.ts    # 7 realistic email templates
public/manifest.json                     # PWA manifest
public/logo.svg                          # brand logo
```

---

## Current goals / completed modifications / verification results

### Completed
- Full Prisma schema with inbox quota, message auth results, attachments (JSON), abuse reports
- 9 API endpoints covering inbox CRUD, message CRUD, alias check, stats
- Socket.IO service generating realistic mail (OTP, registration, newsletter, social, shopping,
  security, attachment, phishing-spoof templates) every 12s with 45% chance when subscribed
- Auto-expiry sweep every 30s that deletes expired inboxes + notifies the client
- Brand: emerald/teal gradient (NOT indigo/blue per design rules)
- All 5 sections fully built and interactive
- agent-browser verified: generate → socket delivery → message reader all work end-to-end
- ESLint passes with 0 errors

### Verification results
- `bun run lint` → 0 errors, 0 warnings
- `curl /api/domains` → 200 with full domain list
- `curl /api/inboxes POST` → 201 with created inbox
- agent-browser: page renders, inbox scramble animation plays, "Test mail" triggers delivery,
  messages appear in real time (badge count updates), message reader shows HTML body in iframe

---

## Unresolved issues or risks, and priority recommendations for the next phase

### Known limitations (by design)
1. **Mock email generation, not real SMTP** — the PRD specified real Postfix SMTP receipt, which
   is impossible in this sandbox. The mail-service generates realistic synthetic mail instead.
   This is clearly disclosed in the About section FAQ.
2. **Session stored in a non-HttpOnly cookie fallback** — the session ID is created server-side
   and set via `Set-Cookie` header, but since this is a demo without auth middleware, the cookie
   is set on the API response. The getSessionOrCreate helper handles both new and existing sessions.

### Recommended next-phase work
1. **Swipe gestures on message cards** — the PRD's MOTION-SYSTEM.md specifies swipe-left-to-delete
   and swipe-right-to-toggle-read. Currently only hover/click quick-actions are implemented.
   Priority: Medium (nice-to-have polish).
2. **Sound feedback** — the settings toggle exists but no actual sound is played on new mail.
   Need a short WebAudio chime. Priority: Low.
3. **Pull-to-refresh on mobile** — specified in motion system, not yet implemented. Priority: Low.
4. **Multi-tab sync (BroadcastChannel)** — read/unread state could desync across tabs of same
   origin. Priority: Medium.
5. **Image generation for About/empty states** — could use the image-generation skill to create
   branded illustrations for the empty states and About hero. Priority: Low.
6. **More email template variety** — currently 7 templates; could add more Indian-context templates
   (UPI payment confirmations, exam hall tickets, etc.). Priority: Low.
7. **Admin panel** — the AbuseReport model exists but there's no admin view to review reported
   messages. Priority: Low (was Phase 3 in PRD).
8. **Search across all inboxes** — current search is per-inbox. Could add global search.
   Priority: Low.

### Risk: gateway port assumption
The socket connection relies on the Caddy gateway (`?XTransformPort=3003`). When testing with
`agent-browser open http://localhost:3000` (direct, bypassing gateway), the socket fails silently.
Always test via `http://localhost:81` (the gateway). The Preview Panel uses the gateway, so end
users are unaffected.

---

*Last updated: initial build complete. Next scheduled review via cron job (every 15 minutes).*
