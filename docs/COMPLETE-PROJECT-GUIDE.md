# StudentTemp — Complete Project Guide

**Made by Roshan** | Last updated: August 2026

This guide explains everything about the StudentTemp project in simple words.
You don't need to be a programmer to understand this.

---

## What Is StudentTemp?

StudentTemp is a **temporary email website**. It's like a disposable phone number,
but for email. Here's how it works:

1. You open the website
2. It gives you a temporary email address (like `student-abc123@studentbox.in`)
3. You use that address to sign up on other websites
4. Any emails sent to that address show up on the website instantly
5. The address expires after a few minutes/hours — then it's gone forever

### Why Would Someone Want This?

- **Privacy:** Don't want to give your real email to every website
- **Spam prevention:** Stop spam from reaching your real inbox
- **Testing:** Developers can test if their email-sending code works
- **OTP verification:** Get verification codes without using your real email

### Example Story

> Rahul wants to sign up on a website called "ExamPrep", but he doesn't want
> to give them his real email. He opens StudentTemp, gets
> `student-xyz123@studentbox.in`, uses it to sign up on ExamPrep. ExamPrep
> sends a verification code to that address. Rahul sees the code on
> StudentTemp, copies it, and finishes signing up. After 10 minutes,
> the temporary address disappears. No spam, no tracking.

---

## What Technology Does It Use?

Think of the project like a restaurant:

| Part of Restaurant | Part of StudentTemp | What It Does |
|--------------------|---------------------|--------------|
| The dining room (where customers sit) | **Frontend** (website you see) | Shows the inbox, messages, buttons |
| The kitchen (where food is prepared) | **Backend** (server code) | Creates inboxes, stores messages |
| The filing cabinet (where records are kept) | **Database** | Saves all inboxes, messages, accounts |
| The mail delivery truck | **SMTP Server** | Receives real emails from the internet |
| The restaurant's phone system | **WebSocket** | Shows new messages instantly without refreshing |
| The building itself | **Hosting platform** (Render) | Where the whole thing runs |

### Specific Technologies

| Technology | What It Is | Why We Use It |
|------------|-----------|---------------|
| **Next.js** | A tool for building websites | It's fast, modern, and handles both frontend and backend |
| **TypeScript** | A programming language | It's JavaScript with extra safety checks |
| **Prisma** | A database tool | Makes it easy to save and read data without writing SQL |
| **SQLite** (dev) / **PostgreSQL** (prod) | Database storage | SQLite is for local testing, PostgreSQL is for production |
| **Socket.IO** | Real-time communication | Shows new emails instantly without page refresh |
| **Tailwind CSS** | Styling tool | Makes the website look good without writing separate CSS files |
| **shadcn/ui** | UI component library | Pre-made buttons, dialogs, cards, etc. |
| **bcrypt** | Password hashing | Stores passwords safely (never in plain text) |
| **DOMPurify** | HTML sanitizer | Removes dangerous code from emails (prevents hacking) |
| **mailauth** | Email authentication | Checks if emails are really from who they say they're from (SPF/DKIM/DMARC) |

---

## How The Project Is Organized

```
studenttemp/
│
├── src/                          ← All the website code
│   ├── app/                      ← Pages and API routes
│   │   ├── page.tsx              ← The main page (what users see)
│   │   ├── layout.tsx            ← The page layout (fonts, theme, etc.)
│   │   └── api/                  ← Backend API routes (40 endpoints)
│   │       ├── auth/             ← Login, signup, logout
│   │       ├── inboxes/          ← Create/list/delete inboxes
│   │       ├── messages/         ← Read/reply/forward/delete messages
│   │       ├── accounts/         ← Account mode (labels, filters, contacts)
│   │       ├── admin/            ← Admin dashboard
│   │       ├── site-access/      ← Password gate for testing
│   │       └── webhooks/         ← Receives email delivery updates
│   │
│   ├── components/               ← Reusable UI parts
│   │   ├── sections/             ← Main screens (inbox, messages, settings, etc.)
│   │   ├── ui/                   ← shadcn/ui components (buttons, cards, etc.)
│   │   ├── site-access-gate.tsx  ← Password protection screen
│   │   └── app-shell.tsx         ← Main app layout with navigation
│   │
│   ├── lib/                      ← Shared code
│   │   ├── db.ts                 ← Database connection
│   │   ├── auth-utils.ts         ← Password hashing, TOTP (2FA)
│   │   ├── mail-utils.ts         ← Session management, rate limiting
│   │   ├── store.ts              ← App state management (Zustand)
│   │   ├── api-client.ts         ← Functions to call the backend API
│   │   └── file-scanner.ts       ← Scans attachments for viruses
│   │
│   └── hooks/                    ← React hooks (reusable logic)
│       ├── use-socket.ts         ← WebSocket connection
│       └── use-service-worker.ts ← PWA offline support
│
├── mini-services/
│   └── mail-service/             ← The email server (separate program)
│       └── index.ts              ← SMTP server + Socket.IO + email processing
│
├── prisma/
│   ├── schema.prisma             ← Database structure (21 tables)
│   └── seed.ts                   ← Seeds 94 email domains
│
├── public/                       ← Static files
│   ├── logo.svg                  ← The StudentTemp logo
│   ├── manifest.json             ← PWA manifest (for "Install App")
│   ├── sw.js                     ← Service worker (offline support)
│   └── robots.txt                ← SEO instructions for Google
│
├── docs/                         ← Documentation
│   ├── deploy/                   ← Deployment guides
│   │   ├── DEPLOYMENT-RUNBOOK.md ← Step-by-step production guide
│   │   └── FREE-DEPLOY-STATUS.md ← Free deployment status
│   ├── audit/                    ← Audit reports (Phases 0-15)
│   └── decisions/                ← Architecture decisions
│
├── .github/
│   └── workflows/
│       └── ci.yml                ← Automated tests (runs on every git push)
│
├── package.json                  ← List of dependencies (like a shopping list)
├── next.config.ts                ← Next.js configuration
├── render.yaml                   ← Render deployment configuration
├── .env.example                  ← Template for environment variables
└── README.md                     ← Project overview
```

---

## The Two Modes

StudentTemp has two modes:

### 1. Temp Mode (Anonymous)
- No login required
- You get a random email address
- The address expires after 5-60 minutes
- Good for quick, one-time use

### 2. Account Mode (Registered)
- You create an account with email + password
- You get a permanent email address
- Extra features: labels, filters, contacts, 2FA, vacation responder
- Good for long-term use

---

## All The Features

### Temp Mode Features
1. ✅ Generate random email address
2. ✅ Choose from 94 domains (studentbox.in, campusmail.in, etc.)
3. ✅ Real-time message delivery (no page refresh needed)
4. ✅ HTML email rendering (safe, sanitized)
5. ✅ Message threading (group replies together)
6. ✅ Reply, Reply All, Forward
7. ✅ Bulk message actions (select, delete, mark read)
8. ✅ Search across all messages
9. ✅ QR code sharing (scan to copy address)
10. ✅ Inbox expiration with countdown timer
11. ✅ "Burn on read" mode (message deletes after reading)
12. ✅ Dark mode
13. ✅ 7 languages (English, Hindi, Tamil, Bengali, Telugu, Marathi, Odia)
14. ✅ PWA (installable on phone)
15. ✅ Web Push notifications
16. ✅ App Lock (PIN or biometric)
17. ✅ Keyboard shortcuts + Command Palette (Cmd+K)
18. ✅ Swipe gestures (mobile)
19. ✅ Pull-to-refresh
20. ✅ Message export (.eml format)
21. ✅ Analytics dashboard
22. ✅ "Receive Mail" bridge (simulate receiving from Gmail/Lovable/etc.)

### Account Mode Features
23. ✅ Sign up with email + password
24. ✅ Profile setup (5-step wizard)
25. ✅ Login with 2FA (TOTP — Google Authenticator)
26. ✅ Labels with colors and retention policies
27. ✅ Filters (automatically label/forward/delete incoming mail)
28. ✅ Contacts manager
29. ✅ Vacation auto-responder
30. ✅ Storage usage meter
31. ✅ Export all data (JSON)
32. ✅ Account deletion with 14-day grace period
33. ✅ Active sessions management (sign out other devices)
34. ✅ Admin dashboard (system stats)
35. ✅ Send-As aliases

### Security Features
36. ✅ Password hashing (bcrypt, 12 rounds)
37. ✅ Secure cookies (HttpOnly, Secure, SameSite=Strict)
38. ✅ 8 security headers (CSP, HSTS, X-Frame-Options, etc.)
39. ✅ HTML sanitization (DOMPurify — removes scripts from emails)
40. ✅ File scanner (blocks executables, checks magic bytes)
41. ✅ Rate limiting (prevents abuse)
42. ✅ IDOR protection (can't access other people's data)
43. ✅ Proof-of-Work challenge (prevents bots)
44. ✅ Spoofing detection (punycode, brand names)
45. ✅ Site access password gate

---

## All The API Endpoints

The backend has 40+ API routes. Here are the main ones:

### Authentication
| Method | URL | What It Does |
|--------|-----|--------------|
| POST | `/api/auth/signup` | Create a new account |
| POST | `/api/auth/login` | Login (with 2FA if enabled) |
| POST | `/api/auth/logout` | Logout (revoke session) |
| GET | `/api/auth/me` | Get current user info |

### Inboxes (Temp Mode)
| Method | URL | What It Does |
|--------|-----|--------------|
| GET | `/api/inboxes` | List your active inboxes |
| POST | `/api/inboxes` | Create a new inbox |
| GET | `/api/inboxes/[id]` | Get inbox details |
| DELETE | `/api/inboxes/[id]` | Delete an inbox |
| GET | `/api/inboxes/[id]/messages` | List messages in inbox |
| POST | `/api/inboxes/[id]/test-mail` | Send a test email to inbox |
| POST | `/api/inboxes/[id]/receive-mail` | Simulate receiving email |

### Messages
| Method | URL | What It Does |
|--------|-----|--------------|
| GET | `/api/messages/[id]` | Read a message |
| DELETE | `/api/messages/[id]` | Delete a message |
| POST | `/api/messages/[id]/reply` | Reply to a message |
| POST | `/api/messages/[id]/forward` | Forward a message |
| POST | `/api/messages/[id]/report` | Report as abuse/spam |
| GET | `/api/messages/[id]/attachments/[attId]` | Download attachment |

### Account Mode
| Method | URL | What It Does |
|--------|-----|--------------|
| GET/POST | `/api/accounts/labels` | List/create labels |
| PATCH/DELETE | `/api/accounts/labels` | Update/delete labels |
| GET/POST | `/api/accounts/filters` | List/create filters |
| DELETE | `/api/accounts/filters` | Delete filters |
| GET/POST | `/api/accounts/contacts` | List/create contacts |
| DELETE | `/api/accounts/contacts` | Delete contacts |
| GET/POST | `/api/accounts/drafts` | List/save drafts |
| GET | `/api/accounts/sent` | List sent messages |
| GET/POST | `/api/accounts/aliases` | List/create send-as aliases |
| GET/DELETE | `/api/accounts/sessions` | List/revoke login sessions |
| GET/PUT | `/api/accounts/vacation` | Get/set vacation responder |
| POST | `/api/accounts/delete` | Delete account (14-day grace) |
| GET | `/api/accounts/export` | Export all data as JSON |
| POST | `/api/accounts/2fa/setup` | Generate TOTP secret + QR |
| POST | `/api/accounts/2fa/verify` | Verify code + enable 2FA |
| POST | `/api/accounts/2fa/backup-codes` | Regenerate backup codes |

### Other
| Method | URL | What It Does |
|--------|-----|--------------|
| GET | `/api/domains` | List all 94 available domains |
| GET | `/api/stats` | Get session statistics |
| POST | `/api/send-mail` | Send an outbound email |
| GET | `/api/search` | Search across all messages |
| GET | `/api/analytics` | Get analytics data |
| POST | `/api/contact` | Send a support message |
| POST | `/api/site-access/verify` | Verify site access password |
| GET | `/api/site-access/verify` | Check if access granted |
| POST | `/api/webhooks/relay` | Receive delivery/bounce from Resend/Brevo |
| GET | `/api/track/open` | Tracking pixel for email opens |
| GET | `/api/admin/stats` | Admin dashboard statistics |
| GET | `/api/legal/[doc]` | Get legal documents (privacy, terms) |

---

## Database Structure

The database has 21 tables. Here's what each one stores:

| Table | What It Stores |
|-------|---------------|
| **Session** | Anonymous browsing sessions (Temp Mode) |
| **Domain** | The 94 email domains available |
| **Inbox** | Temporary/permanent email addresses |
| **CustomAlias** | Anti-squatting cooldown for custom addresses |
| **Message** | All received emails |
| **Attachment** | Files attached to emails |
| **AbuseReport** | Reports of spam/phishing |
| **RateLimitBucket** | Rate limiting data |
| **NotificationSubscription** | Web Push subscriptions |
| **AuditLog** | Security audit trail |
| **Account** | Registered user accounts |
| **Label** | Email labels (like folders) |
| **Filter** | Email filter rules |
| **Contact** | Saved contacts |
| **Draft** | Unsent email drafts |
| **SentMessage** | Sent email tracking |
| **AccountAlias** | Send-as aliases |
| **LoginSession** | Active login sessions |
| **BackupCode** | 2FA backup codes |
| **VacationResponder** | Auto-reply settings |
| **AppPassword** | IMAP/POP3 app passwords |

---

## Environment Variables Explained

Think of environment variables like settings on your phone — they tell the
app how to behave in different situations.

| Variable | What It Does | Example Value |
|----------|-------------|----------------|
| `DATABASE_URL` | Where the database is | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key for push notifications | `BAM5z5-mzFBs...` |
| `VAPID_PRIVATE_KEY` | Private key for push notifications (secret!) | `VqCsw13sjP6U...` |
| `SITE_ACCESS_PASSWORD_HASH` | Password gate (SHA-256 hash) | `89ca16241208...` |
| `SMTP_RELAY_HOST` | Where the mail server is | `localhost` |
| `SMTP_RELAY_PORT` | Mail server port | `2525` |
| `TRUSTED_PROXY_HOSTS` | Who can send proxy headers | `127.0.0.1,::1` |
| `PUBLIC_BASE_URL` | The website's public URL | `https://studenttemp.onrender.com` |
| `RESEND_API_KEY` | Resend email service key | `re_xxxxx...` |
| `TOTP_ENCRYPTION_KEY` | Key for encrypting 2FA secrets | (32-byte hex string) |
| `NODE_ENV` | Environment mode | `production` |

---

## How To Deploy On Render (Step By Step)

Render is a free hosting platform. Here's how to put your website on the
internet for $0.

### Before You Start

You need:
1. A GitHub account (free) — you already have one
2. The code pushed to GitHub (already done — `Manash07Bhoi/studenttemp`)
3. 15 minutes of time

### Step 1: Go to Render

1. Open https://render.com in your browser
2. Click **Sign Up** (top right)
3. Sign up with your GitHub account (click "GitHub" button)
4. Authorize Render to access your GitHub

### Step 2: Create a PostgreSQL Database

1. On the Render dashboard, click **New +** → **PostgreSQL**
2. Fill in:
   - **Name:** `studenttemp-db`
   - **Database:** `studenttemp`
   - **User:** (leave default)
   - **Region:** Choose the closest to you
   - **Plan:** Free
3. Click **Create Database**
4. Wait for it to be ready (takes ~1 minute)
5. Copy the **Internal Database URL** — it looks like:
   `postgresql://user:password@host:5432/studenttemp`
6. Save this somewhere — you'll need it in Step 4

### Step 3: Create the Web Service (Website + API)

1. On the Render dashboard, click **New +** → **Web Service**
2. Connect your GitHub repository:
   - Click **Connect** next to `Manash07Bhoi/studenttemp`
3. Fill in:
   - **Name:** `studenttemp-web`
   - **Runtime:** Node
   - **Build Command:** `bun install && bun run build`
   - **Start Command:** `bun run start`
   - **Plan:** Free
4. Scroll down to **Environment Variables** and add these:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (paste the Internal Database URL from Step 2) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BAM5z5-mzFBsOX1gUppiivXRS0PqvobSbCbdvSRmYw3JbEy1_vV0zyNlryHOY1-CmaKpsOVTkwNQ9nyFpKUZXJ0` |
| `VAPID_PRIVATE_KEY` | `VqCsw13sjP6U8At4VLVnvdaWHBHj1fOld07Szz2oIeI` |
| `SITE_ACCESS_PASSWORD_HASH` | `89ca16241208394e00585912872ecf65b47a8ef3f549355bc6d4a8dc0ca49cca` |
| `SMTP_RELAY_HOST` | `localhost` |
| `SMTP_RELAY_PORT` | `2525` |
| `TRUSTED_PROXY_HOSTS` | `127.0.0.1,::1,localhost` |
| `NODE_ENV` | `production` |
| `PUBLIC_BASE_URL` | (leave empty for now — fill after first deploy) |

5. Click **Create Web Service**
6. Wait for the build to finish (takes 3-5 minutes)
7. When it's done, you'll see a URL like `https://studenttemp-web.onrender.com`
8. Copy that URL
9. Go back to **Environment** → Add `PUBLIC_BASE_URL` with the URL you just copied
10. Save and trigger a redeploy

### Step 4: Create the Mail Service (Email Server)

1. On the Render dashboard, click **New +** → **Background Worker**
2. Connect the same repository (`Manash07Bhoi/studenttemp`)
3. Fill in:
   - **Name:** `studenttemp-mail`
   - **Runtime:** Node
   - **Build Command:** `cd mini-services/mail-service && bun install`
   - **Start Command:** `cd mini-services/mail-service && bun run index.ts`
   - **Plan:** Free
4. Add environment variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (same Internal Database URL from Step 2) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BAM5z5-mzFBsOX1gUppiivXRS0PqvobSbCbdvSRmYw3JbEy1_vV0zyNlryHOY1-CmaKpsOVTkwNQ9nyFpKUZXJ0` |
| `VAPID_PRIVATE_KEY` | `VqCsw13sjP6U8At4VLVnvdaWHBHj1fOld07Szz2oIeI` |

5. Click **Create Background Worker**
6. Wait for it to start (takes 1-2 minutes)

### Step 5: Push Database Schema

After both services are running, you need to create the database tables:

1. On the Render dashboard, go to your **studenttemp-web** service
2. Click the **Shell** tab (or "Terminal")
3. Run these commands:
```bash
bun run db:push
bun run prisma/seed.ts
```
4. This creates all 21 tables and seeds 94 email domains

### Step 6: Test Your Live Website

1. Open your web service URL (e.g., `https://studenttemp-web.onrender.com`)
2. You should see the **password gate** screen
3. Enter: `StudentTemp#8800Roshan`
4. The website should load!
5. Try generating an inbox and sending a test email

### Step 7: Set Up Outbound Email (Resend)

1. Go to https://resend.com → Sign up (free, no card)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `re_`)
4. Go back to Render → **studenttemp-web** → **Environment**
5. Add: `RESEND_API_KEY` = `re_your_key_here`
6. Save and redeploy

### Step 8: Generate TOTP Encryption Key

For 2FA to work, you need a random encryption key:

1. On the Render shell, run:
```bash
openssl rand -hex 32
```
2. Copy the output (64-character hex string)
3. Add as environment variable: `TOTP_ENCRYPTION_KEY` = (the hex string)
4. Save and redeploy

---

## What Works vs What Doesn't On Render

| Feature | Works on Render? | Why |
|---------|----------------|-----|
| Website (all screens) | ✅ Yes | Next.js runs perfectly |
| Database | ✅ Yes | Render provides free PostgreSQL |
| Account Mode | ✅ Yes | All APIs work |
| Real-time WebSocket | ✅ Yes | Render supports WebSocket |
| SMTP receiving | ✅ Yes | Mail service runs as background worker |
| Outbound email | ✅ Yes | Via Resend API |
| Security headers | ✅ Yes | Set in next.config.ts |
| Site access gate | ✅ Yes | Middleware works |
| Receive Mail bridge | ✅ Yes | API route works |
| External email (Gmail→You) | ❌ No | Needs a domain + MX records (buy later) |
| Push notifications | ✅ Yes | VAPID keys configured |

---

## For AI Coding Agents

If you are an AI coding agent reading this, here's what you need to know:

### Project State
- **Phase:** Production-ready (code complete, audited)
- **GitHub Repo:** `Manash07Bhoi/studenttemp` (private)
- **Lint:** 0 errors
- **TypeScript:** 0 production errors
- **Tests:** 10/10 E2E API tests passing
- **Security:** 8/8 security headers, secure cookies, 2FA, sanitization

### Architecture
- Next.js 16 (App Router, Turbopack) on port 3000
- mail-service (smtp-server + Socket.IO) on ports 2525 + 3003
- Caddy reverse proxy on port 81 (sandbox) / Render handles proxying in prod
- Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- Trusted-proxy middleware in `src/proxy.ts`
- Site access gate in `src/components/site-access-gate.tsx`

### Key Files to Read First
1. `prisma/schema.prisma` — All 21 database models
2. `src/lib/api-client.ts` — All API endpoints (typed)
3. `src/lib/store.ts` — State management (Zustand)
4. `mini-services/mail-service/index.ts` — SMTP + Socket.IO server
5. `docs/audit/FINAL-AUDIT-SUMMARY-V3.md` — Complete audit results
6. `docs/decisions/OPEN-QUESTIONS.md` — Architectural decisions
7. `docs/deploy/DEPLOYMENT-RUNBOOK.md` — Production deployment guide

### Rules
1. Never commit `.env` — it contains secrets
2. Never reuse sandbox VAPID keys in production
3. Always run `bun run lint` after changes
4. Preserve "Developed by Roshan" credit everywhere
5. The `.env.production` file has fresh VAPID keys — use those for production

### Environment Variables for Production
See `.env.production` for the complete list with values. The fresh VAPID keys are:
- Public: `BAM5z5-mzFBsOX1gUppiivXRS0PqvobSbCbdvSRmYw3JbEy1_vV0zyNlryHOY1-CmaKpsOVTkwNQ9nyFpKUZXJ0`
- Private: `VqCsw13sjP6U8At4VLVnvdaWHBHj1fOld07Szz2oIeI`
