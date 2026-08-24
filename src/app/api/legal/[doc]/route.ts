// GET /api/legal/[doc] — return real legal document content
import { NextRequest, NextResponse } from 'next/server'

const LEGAL: Record<string, { title: string; updated: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'August 2026',
    body: `# Privacy Policy\n\n## 1. What we collect\nStudentTemp is designed around data minimization. We collect only what is strictly necessary to operate a temporary email service:\n\n- **Anonymous session token** — a randomly generated code (format \`ST-XXXX-XXXX\`) stored as an HttpOnly, SameSite=Strict cookie. We store only the SHA-256 hash server-side.\n- **Inbox records** — local-part, domain, expiry, and creation time. No content metadata retained beyond expiry.\n- **Messages** — stored until inbox expires, then hard-deleted (no archive).\n- **Audit logs** — hashed IP (HMAC-SHA256 with rotating secret) and action type, retained 90 days.\n\n## 2. What we do NOT collect\n- No name, email, phone, or personal identifier.\n- No third-party analytics or tracking cookies.\n- No biometric data (App Lock is local-only via WebAuthn).\n\n## 3. Data lifecycle\n- Inbox + messages: deleted on expiry (max 24h).\n- Attachments: deleted from object storage before DB row removal.\n- Audit logs: 90 days.\n- Session tokens: 7-day rolling TTL.\n\n## 4. Your rights (India DPDP Act 2023, GDPR-compatible)\n- Access: use /settings → Export.\n- Erasure: use /settings → "Clear all active inboxes".\n- Portability: export as JSON.\n\nContact: privacy@studenttemp.example\n\n## 5. Children\nNo personal data collected from children. No marketing directed at minors.\n\n## 6. Security\nHTTPS + HSTS. HTML rendered in sandboxed iframe. External resources blocked by default. SPF/DKIM/DMARC shown per message.\n\n## 7. Breach notification\nConfirmed breaches published on status page within 72 hours.\n\n## 8. Contact\nprivacy@studenttemp.example`
  },
  terms: {
    title: 'Terms of Service',
    updated: 'August 2026',
    body: `# Terms of Service\n\n## 1. Acceptance\nBy using StudentTemp, you agree to these terms.\n\n## 2. Service description\nStudentTemp is a free, privacy-first temporary email platform. We issue short-lived, disposable inboxes that auto-expire. We do not provide permanent email or impersonate real institutions.\n\n## 3. Permitted use\n- One-time verifications and OTP retrieval.\n- Throwaway sign-ups.\n- Testing email flows.\n- Reading newsletters anonymously.\n\n## 4. Prohibited use\n- Spam, phishing, or unsolicited bulk mail.\n- Receiving/distributing illegal content.\n- Impersonating real persons, institutions, or businesses.\n- Enumerating or scraping the alias system.\n- Bypassing security controls.\n\nViolation results in session termination and IP-level blocking.\n\n## 5. No warranty\nService is provided "as is" without warranty.\n\n## 6. Limitation of liability\nMax liability = amount paid in last 12 months (zero, since service is free).\n\n## 7. Termination\nWe may suspend access for abuse. You may terminate by clearing your session.\n\n## 8. Governing law\nLaws of India. Disputes resolved in courts of Bengaluru.\n\n## 9. Contact\nlegal@studenttemp.example`
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    updated: 'August 2026',
    body: `# Acceptable Use Policy\n\n## Allowed\n- Temporary inboxes for personal one-time verifications.\n- Multiple inboxes (up to per-session quota) for parallel sign-ups.\n- Reporting abusive messages via the in-app Report feature.\n- Developer API (Phase 3) within published rate limits.\n\n## Not allowed\n- Receiving passwords or banking OTPs belonging to others.\n- Selling or renting addresses.\n- Automated abuse of alias-availability endpoint.\n- Sending mail to non-consenting recipients.\n- Testing exploit payloads against third parties.\n\n## Consequences\n1st violation: warning + rate-limit reduction.\n2nd violation: 24-hour IP block.\n3rd violation: permanent IP block + session forfeiture.`
  },
  abuse: {
    title: 'Abuse Policy',
    updated: 'August 2026',
    body: `# Abuse Policy\n\n## Reporting abuse\nUse the in-app Report option on any message:\n- Spam → Report → Spam\n- Phishing → Report → Phishing\n- Harassment → Report → Abuse\n- Other → Report → Other\n\nReports are reviewed by moderation. Sender is not notified.\n\n## What happens to reported messages\n- Flagged in database.\n- Used to tune future filtering.\n- Repeat-offender senders may be blocklisted.\n\n## Reporting platform abuse\nContact abuse@studenttemp.example with IP, time, and nature of abuse.\n\n## Reversing a report\nCannot be un-reported from UI. No negative consequence for reporter or sender beyond a moderation flag.`
  },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  const legal = LEGAL[doc]
  if (!legal) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  return NextResponse.json(legal)
}
