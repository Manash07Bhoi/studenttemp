# MX Records + Caddy Configuration Guide

This document explains how to configure DNS MX records and Caddy reverse proxy
for production deployment so that real emails from Gmail/Outlook can reach your
StudentTemp mailboxes.

---

## Part 1: DNS Configuration (MX Records)

### What Are MX Records?

MX records tell the internet "where to send email for this domain." When Gmail
sends an email to `test@studentbox.in`, it looks up the MX record for
`studentbox.in` to find the server that should receive it.

### Step 1: Buy a Domain

You need a real domain (like `studentbox.in` or `studenttemp.com`). Buy one
from:
- **Namecheap** — $1-8 for .in domains
- **Cloudflare** — at-cost domain registration
- **Google Domains** — now Squarespace

### Step 2: Set DNS Records

At your domain registrar's DNS panel, add these records:

| Type | Name/Host | Value/Target | Priority | TTL |
|------|----------|-------------|----------|-----|
| A | `@` | `YOUR_VPS_IP` | - | 3600 |
| A | `mail` | `YOUR_VPS_IP` | - | 3600 |
| MX | `@` | `mail.yourdomain.com` | 10 | 3600 |
| TXT | `@` (SPF) | `v=spf1 mx a -all` | - | 3600 |
| TXT | `_dmarc` (DMARC) | `v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com` | - | 3600 |
| PTR | (reverse DNS) | `mail.yourdomain.com` | - | - |

### Step 3: Set Up DKIM (for Gmail inbox delivery)

DKIM adds a digital signature to your emails so Gmail knows they're really from you.

```bash
# On your VPS:
apt install -y opendkim opendkim-tools

# Generate DKIM keys
opendkim-genkey -s default -d yourdomain.com
# This creates two files:
#   default.private  (keep this on the server — SECRET)
#   default.txt      (publish this as a DNS record)

# View the DNS record to publish:
cat default.txt
# It looks like:
# default._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3..."

# Add this as a TXT record in your DNS panel:
# Name: default._domainkey.yourdomain.com
# Value: (the content from default.txt)
```

### Step 4: Set Up PTR (Reverse DNS)

PTR records tell other mail servers "this IP address belongs to this domain."
Without it, Gmail will mark your emails as spam.

- Go to your VPS provider's dashboard (Oracle Cloud, AWS, etc.)
- Find the "Reverse DNS" or "PTR Record" setting
- Set it to `mail.yourdomain.com`

### Step 5: Verify DNS Propagation

```bash
# Check MX records (should show your mail server)
dig MX yourdomain.com

# Check SPF
dig TXT yourdomain.com

# Check DKIM
dig TXT default._domainkey.yourdomain.com

# Check DMARC
dig TXT _dmarc.yourdomain.com
```

Wait 5-30 minutes for DNS to propagate.

---

## Part 2: Caddy Configuration (HTTPS + Reverse Proxy)

### What Is Caddy?

Caddy is a reverse proxy that sits in front of your Next.js app and handles:
1. **HTTPS/TLS** — automatically gets SSL certificates from Let's Encrypt (free)
2. **HTTP→HTTPS redirect** — redirects all HTTP traffic to HTTPS
3. **Reverse proxy** — forwards requests to Next.js (port 3000)
4. **WebSocket** — forwards Socket.IO connections to the mail-service (port 3003)

### Step 1: Install Caddy on Your VPS

```bash
# Ubuntu/Debian:
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

### Step 2: Configure Caddy

Create `/etc/caddy/Caddyfile`:

```caddyfile
# Replace yourdomain.com with your actual domain

yourdomain.com {
    # Forward all traffic to Next.js
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }

    # WebSocket gateway for Socket.IO (via XTransformPort query param)
    @socketio query XTransformPort=*
    handle @socketio {
        reverse_proxy localhost:{query.XTransformPort} {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }
}

# Redirect HTTP to HTTPS (Caddy does this automatically, but explicit is clear)
http://yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
```

### Step 3: Reload Caddy

```bash
# Validate the config
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Reload (zero downtime)
systemctl reload caddy

# Verify HTTPS works
curl -sSI https://yourdomain.com
# Expected: HTTP/1.1 200 OK

# Verify the TLS certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com </dev/null 2>&1 | head -20
# Expected: "BEGIN CERTIFICATE"
```

Caddy automatically:
- Gets a free SSL certificate from Let's Encrypt
- Renews it before it expires (every 90 days)
- Redirects all HTTP to HTTPS
- Forwards `X-Forwarded-Proto: https` to Next.js (so cookies get `Secure` flag)

---

## Part 3: Postfix Configuration (Inbound SMTP on Port 25)

### What Is Postfix?

Postfix is a mail server that listens on port 25 (the standard email port).
It receives emails from Gmail/Outlook and forwards them to the StudentTemp
mail-service on port 2525.

### Step 1: Install Postfix

```bash
apt install -y postfix
# During setup, choose "Internet Site"
# Set the mail name to: yourdomain.com
```

### Step 2: Configure Postfix to Relay to StudentTemp

```bash
cat > /etc/postfix/main.cf << 'EOF'
myhostname = mail.yourdomain.com
mydomain = yourdomain.com
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4
mydestination = $myhostname, localhost.$mydomain, localhost
mynetworks = 127.0.0.0/8
transport_maps = hash:/etc/postfix/transport
relay_domains = yourdomain.com
smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination
EOF

# Forward all mail for yourdomain.com to the StudentTemp mail-service
cat > /etc/postfix/transport << 'EOF'
yourdomain.com smtp:[127.0.0.1]:2525
EOF
postmap /etc/postfix/transport

# Restart Postfix
systemctl restart postfix
```

### Step 3: Open Port 25 in the Firewall

```bash
ufw allow 25/tcp
ufw allow 443/tcp
ufw allow 80/tcp
```

### Step 4: Test End-to-End Mail Delivery

1. Open Gmail
2. Compose an email to `test@yourdomain.com`
3. Send it
4. Check the StudentTemp mail-service logs:
   ```bash
   tail -f /opt/studenttemp/.zscripts/mini-service-mail-service.log
   ```
5. You should see: `[mail] delivered real message to test@yourdomain.com`

If it doesn't arrive within 1-2 minutes:
- Check DNS propagation: `dig MX yourdomain.com`
- Check Postfix logs: `tail -f /var/log/mail.log`
- Check if port 25 is open: `telnet yourdomain.com 25`
- Check if Gmail marked it as spam (SPF/DKIM/DMARC not set up)

---

## Part 4: Complete Production Architecture

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │   Gmail/Outlook  │
              │   sends email    │
              └────────┬────────┘
                       │ (SMTP port 25)
                       ▼
              ┌─────────────────┐
              │   Your VPS      │
              │   (real IP)     │
              │                 │
              │  ┌────────────┐ │
              │  │  Postfix   │ │  ← receives email on port 25
              │  │  (port 25) │ │
              │  └─────┬──────┘ │
              │        │ relay  │
              │        ▼        │
              │  ┌────────────┐ │
              │  │ mail-service│ │  ← processes email (port 2525)
              │  │ (port 2525) │ │    + Socket.IO (port 3003)
              │  └─────┬──────┘ │
              │        │        │
              │  ┌─────▼──────┐ │
              │  │ PostgreSQL  │ │  ← stores everything
              │  │  (Neon or   │ │
              │  │   local)    │ │
              │  └─────────────┘ │
              │                 │
              │  ┌────────────┐ │
              │  │   Caddy    │ │  ← HTTPS (port 443)
              │  │ (port 443) │ │    + reverse proxy
              │  └─────┬──────┘ │
              └────────┼────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Browser        │
              │  (user visits   │
              │   yourdomain.com)│
              └─────────────────┘
```

### Port Summary

| Port | Service | Purpose |
|------|---------|---------|
| 25 | Postfix | Receive email from internet (SMTP) |
| 80 | Caddy | HTTP → HTTPS redirect |
| 443 | Caddy | HTTPS (secure website) |
| 3000 | Next.js | The website + API |
| 2525 | mail-service | Internal SMTP (receives from Postfix) |
| 3003 | mail-service | Socket.IO (real-time push) |

---

## Part 5: Verification Checklist

After setting everything up, verify:

```bash
# 1. HTTPS works
curl -sSI https://yourdomain.com
# Expected: 200 OK, Server: Caddy

# 2. HTTP redirects to HTTPS
curl -sSI http://yourdomain.com
# Expected: 301 Redirect to https://

# 3. TLS certificate is valid
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com </dev/null 2>&1 | grep "verify return code"
# Expected: verify return code: 0 (ok)

# 4. Security headers present
curl -sSI https://yourdomain.com | grep -iE 'strict-transport|content-security|x-frame'
# Expected: all headers present

# 5. API works over HTTPS
curl -s https://yourdomain.com/api/domains
# Expected: JSON with 94 domains

# 6. Site access gate works
curl -s https://yourdomain.com/api/site-access/verify
# Expected: {"hasAccess":false,"gateEnabled":true}

# 7. Inbound mail works
# Send a test email from Gmail to test@yourdomain.com
# Check logs:
tail -f /opt/studenttemp/.zscripts/mini-service-mail-service.log
# Expected: "[mail] delivered real message to test@yourdomain.com"

# 8. MX records are set
dig MX yourdomain.com
# Expected: your mail server listed

# 9. SPF/DKIM/DMARC are set
dig TXT yourdomain.com
dig TXT default._domainkey.yourdomain.com
dig TXT _dmarc.yourdomain.com
# Expected: all three records exist
```
