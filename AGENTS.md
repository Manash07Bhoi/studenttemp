# 🤖 Agent Instructions for StudentTemp

This file provides critical context for any autonomous coding agents working on this project.

## Architecture & Services
StudentTemp consists of two main services that must be run together in production:
1. **Next.js Web Service** (`src/`, port 3000): Handles UI, API, Account Mode, and standard HTTP requests.
2. **Mail Service Worker** (`mini-services/mail-service/`, ports 2525 and 3003): Handles actual SMTP receiving (via loopback/postfix) and real-time Socket.IO communication with the Web Service.

Both require connection to the same underlying database (PostgreSQL in production).

## Deployment State & Known Blockers
- **Render PostgreSQL:** Successfully provisioned (`studenttemp-db`).
- **Render Web Service/Worker:** **NOT DEPLOYED**.
- **Blocker:** Render's GitHub App is not authorized to fetch the private repository `Manash07Bhoi/studenttemp`. This results in a `400 unfetchable` error when creating the Web Service via API/MCP.
- **Agent Instruction:** Do not attempt to automatically deploy to Render until a human confirms they have granted Render access to the GitHub repository.

## Secret Handling
**NEVER commit real credentials to the repository.**
- VAPID keys, TOTP encryption keys, Site access hashes, and Provider API keys (Resend/Brevo) must remain exclusively in the host environment or external secrets managers (e.g., Render Dashboard).
- The repository must pass a strict secret scan.
- Sentry DSN configuration is public and safe to include in `sentry.*.config.ts`.

## Local Verification Commands
If you need to verify changes locally in a production-like environment:
```bash
# Build the project
bun install
bun run build

# Start SQLite database with seeding
bun run db:push
bun run prisma/seed.ts

# Start the services (requires providing local dev secrets via export)
NODE_ENV=production node .next/standalone/server.js &
cd mini-services/mail-service && bun run index.ts &
```

## Security Posture
- TOTP Secrets are encrypted using AES-256-GCM (Requires `TOTP_ENCRYPTION_KEY`).
- Caddy reverse proxy terminates TLS, so the Next.js app natively runs over HTTP but asserts `Secure` cookies when `TRUSTED_PROXY_HOSTS` matches Caddy.
- API authentication includes explicit rate limits per-route.
