# SMTP Setup — Wiring Real Inbound Mail to StudentTemp

This document explains how to wire a **real** inbound SMTP path to StudentTemp in production.
The dev environment runs a real SMTP server on port 2525 (see `mini-services/mail-service/index.ts`)
that genuinely receives mail, parses real MIME, verifies real SPF/DKIM/DMARC, and stores messages.
In production you point a real MX record at this host.

## Architecture (production)

```
Internet sender (Gmail, Outlook, …)
        │
        │  SMTP (port 25)
        ▼
   Postfix (Oracle Cloud Always-Free VM)
        │  check_recipient_access → tcp_table → StudentTemp API
        │  (rejects unknown/expired recipients at RCPT TO — no backscatter)
        ▼
   StudentTemp mail-service (port 2525 in dev, 25 in prod)
        │  • parses MIME (mailparser)
        │  • verifies SPF/DKIM/DMARC (mailauth, real DNS)
        │  • sanitizes HTML (DOMPurify)
        │  • stores message + attachments
        │  • emits Socket.IO "new message" event
        ▼
   Browser (real-time update)
```

## Dev environment

The dev mail-service already runs a real SMTP server on port 2525. You can send real mail to it:

```bash
# Using swaks (install: apt install swaks)
swaks --to student-xxxxx@studentbox.in --server localhost:2525 --from hello@example.com

# Using Node/Bun + nodemailer
node -e "
const nm = require('nodemailer');
const t = nm.createTransport({ host: 'localhost', port: 2525, tls: { rejectUnauthorized: false } });
t.sendMail({ from: 'hello@example.com', to: 'student-xxxxx@studentbox.in', subject: 'Real test', text: 'Body' }).then(i => console.log(i.response));
"

# Using telnet (raw SMTP)
telnet localhost 2525
HELO client.example
MAIL FROM:<hello@example.com>
RCPT TO:<student-xxxxx@studentbox.in>
DATA
Subject: Real test
Body here.
.
QUIT
```

First create an inbox via the UI (`/` → Generate) so the recipient exists. The mail-service
rejects unknown recipients at `RCPT TO` with `550 5.1.1` (no backscatter — per `GAPS.md` C2).

## Production wiring

1. **Provision a VM** (Oracle Cloud Always-Free ARM VM is recommended — 4 OCPU / 24GB RAM free).
2. **Open port 25 inbound** in the VM's security list + iptables. (Many cloud providers block 25
   by default; Oracle Cloud allows it on Always-Free.)
3. **Point your domain's MX record** at the VM:
   ```
   studentbox.in.    MX  10 mail.studenttemp.example.
   mail.studenttemp.example.  A  <VM public IP>
   ```
4. **Run Postfix on the VM** as an SMTP proxy that forwards to the StudentTemp mail-service
   on port 2525:
   ```
   # /etc/postfix/main.cf
   relay_domains = studentbox.in campususmail.in examprep.in devtest.in quickmail.in
   transport_maps = hash:/etc/postfix/transport
   # /etc/postfix/transport
   studentbox.in  smtp:[127.0.0.1]:2525
   campusmail.in  smtp:[127.0.0.1]:2525
   …
   ```
5. **Optionally enable ClamAV** (`clamd`) on the VM and wire it into the mail-service's
   attachment scan step (look for the `// no ClamAV in dev` comment in `index.ts`).

## SPF / DKIM / DMARC notes

The mail-service computes these from **real** data via the `mailauth` library:
- **SPF**: looked up from the connecting IP + envelope sender (real DNS TXT query).
- **DKIM**: verified by fetching the selector's public key from DNS
  (`<selector>._domainkey.<domain>`).
- **DMARC**: aligned against SPF+DKIM and the domain's DMARC record (real DNS).

In dev, you'll typically see `SPF=fail`/`DKIM=none`/`DMARC=fail` for test senders like
`example.org` (which has `v=spf1 -all` and `p=reject`). This is **correct** behavior — those
results are real. To get `SPF=pass`, send from a domain whose SPF record authorizes your IP
(e.g., add your IP to a domain you own).
