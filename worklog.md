# StudentTemp — Project Worklog (Fresh)

## Project Overview
StudentTemp is a privacy-first temporary email platform. Built with Next.js 16 + Prisma + Socket.IO + Tailwind CSS 4 + shadcn/ui.

**Developer**: Roshan

## Current Status
- **Real SMTP server** on port 2525 (real SPF/DKIM/DMARC via mailauth)
- **94 domains** across 5 categories (Academic, India Student, India General, International, Privacy)
- **7 i18n languages** (English, Hindi, Tamil, Bengali, Telugu, Marathi, Odia)
- **All GAP-ANALYSIS-V2.md + BUGFIX-INBOX-PERSISTENCE.md gaps implemented**
- `bun run lint` → 0 errors
- All services running clean (Next.js 3000, SMTP 2525, Socket.IO 3003, gateway 81)

## Key Files
- `src/app/page.tsx` — main page (only route)
- `src/components/app-shell.tsx` — main app layout
- `mini-services/mail-service/index.ts` — real SMTP + Socket.IO server
- `prisma/schema.prisma` — database schema
- `src/lib/store.ts` — Zustand store
- `src/lib/mail-utils.ts` — shared utilities
- `src/lib/file-scanner.ts` — free ClamAV alternative
- `src/lib/pow-challenge.ts` — free Turnstile alternative
- `.env` — VAPID keys + DB URL + SMTP config

## Implemented Features
1. Real SMTP with SPF/DKIM/DMARC verification
2. 94 domains (including .edu/.ac.in academic domains)
3. 7 i18n languages
4. Message threading + References/In-Reply-To headers
5. Reply / Reply All / Forward
6. Bulk message actions (select, delete, mark-read, star with undo)
7. Global search with highlighting
8. Drag-to-reorder addresses
9. Swipe gestures (delete with undo, read/unread)
10. Long-press context menu
11. Pull-to-refresh
12. Command palette (⌘K) + keyboard shortcuts
13. Analytics dashboard (Recharts)
14. App Lock (WebAuthn + PIN)
15. Web Push notifications (real VAPID keys)
16. Service worker (PWA)
17. Message export (.eml)
18. Contact/Support form with honeypot
19. DPDP consent banner
20. Spoofing detection (punycode, display name, brand names)
21. External link interstitial in message reader
22. File scanner (magic bytes, PE/ELF detection, size limits)
23. Proof-of-work challenge (SHA-256)
24. Spam scoring heuristics (rule-based)
25. Importance markers (rule-based)
26. Mute conversation
27. Print message
28. Inbox persistence (localStorage mirror + restore on load)
29. Offline banner when disconnected
30. Security headers (8 headers including CSP)
31. "Developed by Roshan" credit on About page
32. Test mail button (sends real email via API)

## Remaining Work
- Account Mode (Phase 3+): sign up, login, permanent mailboxes, 2FA, filters, labels, vacation responder
- G3: IMAP/POP3 access (requires Go-based IMAP server)
- G4: Confidential Mode
- G6: Nested labels
- L3: Filter conflict resolution
- L5: Account deletion cleanup

## Cron Job
This worklog is reviewed by a scheduled cron job that:
1. Reviews this file for project status
2. Tests via agent-browser
3. Fixes bugs / adds features
4. Updates this file

## How to Test
```bash
# Generate inbox in browser → copy address → send test email:
bun tests/fixtures/send-test-mail.ts <email> "<subject>" "<body>"
# Or use the "Test mail" button in the Inbox UI
```
