# StudentTemp — Deployment Runbook

**Purpose:** A single, sequential, copy-paste-ready document a human can follow
start to finish to go from "code is done" to "live in production."

**Prerequisites:** You have a real VPS (root access), a real domain, and the
codebase cloned on the VPS.

---

## Step 1: Provision Infrastructure

### 1.1 Buy a Domain
- Use any registrar (Namecheap, Cloudflare, Google Domains)
- Example: `studenttemp.com`

### 1.2 Provision a VPS
- **Recommended:** Oracle Cloud Always-Free VM (4 ARM cores, 24GB RAM — free forever)
- **Alternative:** Fly.io, Railway, or any VPS with root access
- **Minimum specs:** 2GB RAM, 20GB disk, Ubuntu 22.04+

### 1.3 Point DNS to Your VPS
At your registrar's DNS panel, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_VPS_IP` | 3600 |
| A | `mail` | `YOUR_VPS_IP` | 3600 |
| MX | `@` | `mail.studenttemp.com` (priority 10) | 3600 |

**Wait for DNS propagation** (check with `dig MX studenttemp.com` — should return your MX record).

---

## Step 2: Deploy the Application

### 2.1 SSH into your VPS
```bash
ssh root@YOUR_VPS_IP
```

### 2.2 Install dependencies
```bash
# Node.js 20+ and Bun
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Caddy (reverse proxy with auto-HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Postfix (inbound SMTP on port 25)
apt install -y postfix
```

### 2.3 Clone and build the project
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/studenttemp.git
cd studenttemp
bun install
bun run build
```

### 2.4 Set up the database
```bash
# For production: use PostgreSQL instead of SQLite
# Update DATABASE_URL in .env (see Step 4)
bun run db:push
```

### 2.5 Start the services
```bash
# Start Next.js (production mode)
NODE_ENV=production bun run start &

# Start the mail-service (SMTP + Socket.IO)
cd mini-services/mail-service
bun install
bun run index.ts &
cd ../..
```

---

## Step 3: Configure TLS (HTTPS)

### 3.1 Deploy the production Caddyfile

Replace `studenttemp.com` with your actual domain:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
studenttemp.com {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}

# WebSocket gateway for Socket.IO
studenttemp.com {
    @socketio path /socket.io/*
    handle @socketio {
        reverse_proxy localhost:3003
    }
}
EOF
```

### 3.2 Reload Caddy (auto-provisions Let's Encrypt certificate)
```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
```

### 3.3 Verify HTTPS
```bash
# Should return 200 with a valid certificate
curl -sSI https://studenttemp.com

# Should show the TLS certificate
openssl s_client -connect studenttemp.com:443 -servername studenttemp.com </dev/null 2>&1 | head -20
```

---

## Step 4: Configure Inbound Mail (Postfix + MX)

### 4.1 Configure Postfix to relay to the mail-service

```bash
cat > /etc/postfix/main.cf << 'EOF'
myhostname = mail.studenttemp.com
mydomain = studenttemp.com
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4
mydestination = $myhostname, localhost.$mydomain, localhost
mynetworks = 127.0.0.0/8
transport_maps = hash:/etc/postfix/transport
relay_domains = studenttemp.com
smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination
EOF

# Relay all mail for studenttemp.com to the mail-service on port 2525
cat > /etc/postfix/transport << 'EOF'
studenttemp.com smtp:[127.0.0.1]:2525
EOF
postmap /etc/postfix/transport
systemctl restart postfix
```

### 4.2 Open port 25 in the firewall
```bash
ufw allow 25/tcp
ufw allow 443/tcp
ufw allow 80/tcp
ufw allow 3000/tcp  # Next.js (internal)
ufw allow 3003/tcp  # Socket.IO (internal)
ufw allow 2525/tcp  # mail-service SMTP (internal)
```

### 4.3 Set up SPF, DKIM, and DMARC DNS records

| Type | Name | Value |
|------|------|-------|
| TXT | `@` (SPF) | `v=spf1 mx a -all` |
| TXT | `default._domainkey` (DKIM) | (from `opendkim` — see below) |
| TXT | `_dmarc` (DMARC) | `v=DMARC1; p=quarantine; rua=mailto:postmaster@studenttemp.com` |
| PTR | (reverse DNS) | `mail.studenttemp.com` (set at VPS provider) |

**DKIM setup:**
```bash
apt install -y opendkim opendkim-tools
# Generate DKIM keys
opendkim-genkey -s default -d studenttemp.com
# Copy the public key to DNS:
cat default.txt
# Add as TXT record: default._domainkey.studenttemp.com → (the value from default.txt)
```

### 4.4 Verify mail delivery
```bash
# Send a test email from Gmail to test@studenttemp.com
# Then check the mail-service logs:
tail -f /opt/studenttemp/.zscripts/mini-service-mail-service.log
# You should see: "[mail] delivered real message to test@studenttemp.com"
```

---

## Step 5: Clean Git History (VAPID Keys)

The old VAPID keys were committed to git history. They MUST be purged.

### 5.1 Install git-filter-repo
```bash
pip install git-filter-repo
```

### 5.2 Create a mirror clone and purge secrets
```bash
cd /tmp
git clone --mirror https://github.com/YOUR_USERNAME/studenttemp.git studenttemp-mirror.git
cd studenttemp-mirror.git

cat > /tmp/secrets-to-remove.txt << 'EOF'
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFrVmVtbXGLKVihSy3fMpdGllOgt26L1EYkeZJW5jzSqoq7oXX-OzcOCOQXPytUgT7C5JomIU05XNFjl0nOAros
***REMOVED***
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLa1Bz4MYgNUOkMpsbSKVD0ctcZ8OFSppWC4Gepr7cvwSeKQIRtmOB-BUDC5kBp4fVgHMEqPXKVSDiCdZMV5p1o
***REMOVED***
EOF

git filter-repo --replace-text /tmp/secrets-to-remove.txt

# Verify keys are gone
git log --all -p | grep -E 'VAPID_PRIVATE_KEY|NEXT_PUBLIC_VAPID'
# Expected: (no output)
```

### 5.3 Force-push the cleaned history
```bash
git push --force --mirror origin
```

### 5.4 Notify collaborators
All collaborators must re-clone the repo (old clones are invalid):
```bash
rm -rf studenttemp
git clone https://github.com/YOUR_USERNAME/studenttemp.git
```

---

## Step 6: Generate Fresh VAPID Keys + Rotate All Secrets

### 6.1 Generate fresh VAPID keys
```bash
npx web-push generate-vapid-keys
```

### 6.2 Create production `.env` (NEVER commit this file)
```bash
cat > /opt/studenttemp/.env << 'EOF'
# Database (use PostgreSQL for production)
DATABASE_URL=postgresql://user:password@localhost:5432/studenttemp

# VAPID keys (FRESH — generated above, never reused from sandbox)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<NEW_PUBLIC_KEY>
VAPID_PRIVATE_KEY=<NEW_PRIVATE_KEY>

# SMTP relay (internal — Postfix on port 25 relays to mail-service on 2525)
SMTP_RELAY_HOST=localhost
SMTP_RELAY_PORT=2525

# Trusted proxy (Caddy)
TRUSTED_PROXY_HOSTS=127.0.0.1,::1,localhost
PUBLIC_BASE_URL=https://studenttemp.com

# TOTP encryption key (for 2FA secret storage — use a strong random string)
TOTP_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>

# Production
NODE_ENV=production

# Relay provider (for outbound email — Resend or Brevo)
# Sign up at https://resend.com or https://brevo.com
RESEND_API_KEY=<your_resend_api_key>
# OR: BREVO_API_KEY=<your_brevo_api_key>

# Sentry (error tracking — sign up at https://sentry.io)
SENTRY_DSN=<your_sentry_dsn>
EOF

chmod 600 /opt/studenttemp/.env
```

### 6.3 Secrets rotation checklist

| Secret | Current Value | Action |
|--------|--------------|--------|
| `DATABASE_URL` | SQLite file path | **REPLACE** with PostgreSQL connection string |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Compromised (in git history) | **ROTATE** — generate fresh |
| `VAPID_PRIVATE_KEY` | Compromised (in git history) | **ROTATE** — generate fresh |
| `TOTP_ENCRYPTION_KEY` | Not set | **GENERATE** — `openssl rand -hex 32` |
| `RESEND_API_KEY` or `BREVO_API_KEY` | Not set | **GENERATE** — sign up for account |
| `SENTRY_DSN` | Not set | **GENERATE** — sign up for account |
| Admin password | Not set | **GENERATE** — create admin account on first run |

**None of the current sandbox values should ever be reused in production.**

---

## Step 7: Set Up CI/CD + Monitoring

### 7.1 CI/CD (GitHub Actions)

The `.github/workflows/ci.yml` file is already in the repo. It runs:
- ESLint
- TypeScript type-check
- `bun audit`

On every push/PR. Connect your GitHub repo and it will work automatically.

### 7.2 Sentry (Error Tracking)
1. Sign up at https://sentry.io (free tier)
2. Create a new project → select "Next.js"
3. Copy the DSN
4. Add to `.env`: `SENTRY_DSN=<your_dsn>`

### 7.3 Uptime Robot (Uptime Monitoring)
1. Sign up at https://uptimerobot.com (free tier)
2. Add monitor → HTTP(s) → `https://studenttemp.com`
3. Add monitor → HTTP(s) → `https://studenttemp.com/api/auth/me` (API health)
4. Set alert email/Slack

### 7.4 Google Search Console
1. Go to https://search.google.com/search-console
2. Add property → `https://studenttemp.com`
3. Verify via DNS TXT record
4. Submit `sitemap.xml` (create one — see below)

### 7.5 Google Postmaster Tools
1. Go to https://postmaster.google.com
2. Add your domain
3. Verify via DNS TXT record
4. Monitor email deliverability

---

## Step 8: Final Verification Checklist

Run these commands on your production VPS to verify everything works:

```bash
# 1. HTTPS works
curl -sSI https://studenttemp.com
# Expected: HTTP/1.1 200 OK, Server: Caddy

# 2. HTTP redirects to HTTPS
curl -sSI http://studenttemp.com
# Expected: 301 Redirect to https://

# 3. TLS certificate is valid
openssl s_client -connect studenttemp.com:443 -servername studenttemp.com </dev/null 2>&1 | grep "verify return code"
# Expected: verify return code: 0 (ok)

# 4. Security headers present
curl -sSI https://studenttemp.com | grep -iE 'strict-transport|content-security|x-frame'
# Expected: all headers present

# 5. API health
curl -s https://studenttemp.com/api/auth/me
# Expected: {"account":null}

# 6. WebSocket connects via wss://
# (Open browser DevTools → Network → filter "WS" → should show wss:// connection)

# 7. Inbound mail works
# Send a test email from Gmail to test@studenttemp.com
# Check mail-service logs:
tail -f /opt/studenttemp/.zscripts/mini-service-mail-service.log
# Expected: "[mail] delivered real message to test@studenttemp.com"

# 8. Cookie is Secure
curl -s -X POST https://studenttemp.com/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Test","username":"test","domain":"studentbox.in","password":"TestPass123"}' \
  -D - -o /dev/null | grep set-cookie
# Expected: Secure; HttpOnly; SameSite=Strict
```

---

## Rollback Procedure

If something breaks after deployment:

```bash
# 1. Revert the code
cd /opt/studenttemp
git checkout HEAD~1  # previous commit

# 2. Rebuild
bun run build

# 3. Restart services
pkill -f 'next-server'
pkill -f 'bun.*index.ts'
bun run start &
cd mini-services/mail-service && bun index.ts &

# 4. If Caddy config broke, restore previous:
cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile
systemctl reload caddy

# 5. If database migration broke, restore from backup:
# (assuming you have pg_dump backup)
psql studenttemp < backup.sql
```

---

## Post-Deployment: Create Sitemap

```bash
cat > /opt/studenttemp/public/sitemap.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://studenttemp.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
EOF
```

---

## Support

- **Developer:** Roshan
- **Documentation:** See `docs/audit/` for complete audit reports
- **Architecture decisions:** See `docs/decisions/OPEN-QUESTIONS.md`
