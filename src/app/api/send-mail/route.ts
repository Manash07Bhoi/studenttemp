// POST /api/send-mail — compose & send a REAL email via SMTP to an external address
// Uses the real SMTP server (port 2525) on the mail-service, OR nodemailer directly to
// a real external MX host (if SMTP_RELAY_HOST is set). This is REAL email sending, not a mock.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, getClientIp, rateLimit, auditLog, QUOTAS } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const limit = rateLimit(`send-mail:${ip}`, 5, 60 * 60 * 1000) // 5/hour/IP
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit: max 5 sent mails per hour.' }, { status: 429 })
  }
  const { sessionId } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { inboxId, to, subject, text, html } = body || {}

  if (!inboxId || !to || !subject || !text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  // Validate recipient address
  const toAddr = String(to).toLowerCase().trim()
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(toAddr)) {
    return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
  }
  if (String(subject).length > 200) {
    return NextResponse.json({ error: 'Subject too long' }, { status: 400 })
  }
  if (String(text).length > 50_000) {
    return NextResponse.json({ error: 'Body too long' }, { status: 400 })
  }

  // Verify inbox ownership
  const inbox = await db.inbox.findUnique({ where: { id: inboxId } })
  if (!inbox || inbox.sessionId !== sessionId || inbox.status !== 'active') {
    return NextResponse.json({ error: 'Inbox not found or expired' }, { status: 404 })
  }

  // Send via real SMTP. We connect to the mail-service's SMTP server on port 2525
  // and submit a real RFC 5322 message. The mail-service accepts it as if it came
  // from the inbox user, then forwards via outbound relay (configured in prod).
  // In dev (no relay configured), the message is delivered locally to any inbox
  // hosted by this service.
  const relayHost = process.env.SMTP_RELAY_HOST || 'localhost'
  const relayPort = Number(process.env.SMTP_RELAY_PORT) || 2525

  try {
    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host: relayHost,
      port: relayPort,
      secure: false,
      tls: { rejectUnauthorized: false },
    })
    const info = await transporter.sendMail({
      from: inbox.email,
      to: toAddr,
      subject: String(subject),
      text: String(text),
      html: html ? String(html) : undefined,
    })
    await auditLog({ sessionId, action: 'mail.send', targetType: 'inbox', targetId: inboxId, metadata: { to: toAddr, subject, messageId: info.messageId }, ip })
    return NextResponse.json({ ok: true, messageId: info.messageId, response: info.response })
  } catch (e) {
    console.error('[send-mail] error:', e)
    return NextResponse.json({ error: 'Failed to send email: ' + (e as Error).message }, { status: 500 })
  }
}
