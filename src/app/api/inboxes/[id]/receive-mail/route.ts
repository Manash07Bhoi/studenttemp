// POST /api/inboxes/[id]/receive-mail
// Injects a message directly into the inbox (bypasses SMTP).
//
// WHY THIS EXISTS:
// The sandbox SMTP server listens on localhost:2525. External mail providers
// (Gmail, Outlook, Lovable, etc.) cannot reach it because:
//   1. There is no MX record pointing to this host
//   2. Port 25 (privileged) cannot be bound by user `z`
//   3. The sandbox IP is not publicly routable for SMTP
//
// This endpoint lets users simulate receiving an email from any external
// sender (e.g., noreply@lovable.dev, no-reply@google.com) so they can test
// verification flows, OTP delivery, and signup confirmations end-to-end.
//
// The message is stored with the same schema as real SMTP-delivered messages,
// pushed via WebSocket in real-time, and appears identically in the UI.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, getClientIp, rateLimit, hashToken } from '@/lib/mail-utils'
import { createHash } from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = getClientIp(req)
  // Rate limit: 20 received emails per hour per IP (generous for testing)
  const limit = rateLimit(`receive-mail:${ip}`, 20, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many emails. Please wait a few minutes.' },
      { status: 429 }
    )
  }

  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 })
  }
  if (inbox.status !== 'active' || inbox.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Inbox expired' }, { status: 400 })
  }

  // Check quota
  if (inbox.messageCount >= 100) {
    return NextResponse.json({ error: 'Inbox is full' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    fromEmail,
    fromName,
    subject,
    textBody,
    htmlBody,
  } = body || {}

  if (!fromEmail || !subject) {
    return NextResponse.json(
      { error: 'fromEmail and subject are required' },
      { status: 400 }
    )
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(String(fromEmail))) {
    return NextResponse.json({ error: 'Invalid sender email' }, { status: 400 })
  }

  const senderAddress = String(fromEmail).toLowerCase().trim()
  const senderDisplayName = fromName ? String(fromName).trim() : undefined
  const subjectStr = String(subject).slice(0, 500)
  const text = String(textBody || '').slice(0, 100_000)
  const html = htmlBody ? String(htmlBody).slice(0, 500_000) : ''

  // Build preview text
  const previewText = text
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  // Sanitize HTML (basic — strip script/iframe/event handlers)
  let sanitizedHtml = ''
  if (html) {
    sanitizedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<(iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '$1="#"')
      .slice(0, 500_000)
  } else {
    sanitizedHtml = `<div style="font-family:monospace;padding:12px;white-space:pre-wrap">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
  }

  // Detect spam indicators (same heuristic as mail-service)
  let spamScore = 0
  const urgencyKeywords = /verify now|account suspended|urgent|immediate action|confirm your identity|click here to|limited time|act now/i
  if (urgencyKeywords.test(subjectStr) || urgencyKeywords.test(text)) spamScore += 2
  const linkCount = (sanitizedHtml.match(/<a\s/gi) || []).length
  if (linkCount > 10) spamScore += 2
  else if (linkCount > 5) spamScore += 1
  const scanStatus = spamScore >= 6 ? 'quarantined' : 'clean'

  // Create the message
  const message = await db.message.create({
    data: {
      smtpMessageId: `<injected-${Date.now()}-${createHash('md5').update(senderAddress + subjectStr).digest('hex').slice(0, 8)}@studenttemp.dev>`,
      senderAddress,
      senderDisplayName,
      senderIp: ip === '127.0.0.1' ? null : ip,
      subject: subjectStr,
      previewText,
      bodyText: text,
      bodyHtml: sanitizedHtml,
      hasHtml: !!html,
      hasText: !!text,
      hasAttachment: false,
      sizeBytes: Buffer.byteLength(text) + Buffer.byteLength(sanitizedHtml),
      authSpf: 'none',
      authDkim: 'none',
      authDmarc: 'none',
      authDetails: JSON.stringify({
        spf: { result: 'none', reason: 'Injected via API (not via SMTP)' },
        dkim: { result: 'none', reason: 'Injected via API' },
        dmarc: { result: 'none', reason: 'Injected via API' },
        inReplyTo: null,
        references: null,
        injected: true,
      }),
      scanStatus,
      externalResourcesBlocked: 0,
      inbox: { connect: { id: inbox.id } },
    },
  })

  // Increment inbox counter
  await db.inbox.update({
    where: { id: inbox.id },
    data: {
      messageCount: { increment: 1 },
      lastActivityAt: new Date(),
    },
  })

  // Audit log
  await db.auditLog.create({
    data: {
      sessionId,
      action: 'mail.injected',
      targetType: 'message',
      targetId: message.id,
      metadata: JSON.stringify({
        from: senderAddress,
        to: inbox.email,
        subject: subjectStr,
      }),
      ipHash: ip ? hashToken(ip) : null,
    },
  })

  // Push via WebSocket — the mail-service Socket.IO server needs to broadcast.
  // We emit via an internal HTTP endpoint on the mail-service (port 3003).
  try {
    const event = {
      id: message.id,
      publicId: message.publicId,
      inboxId: inbox.id,
      email: inbox.email,
      fromEmail: senderAddress,
      fromName: senderDisplayName || senderAddress,
      subject: subjectStr,
      previewText,
      receivedAt: message.receivedAt,
      category: inbox.category,
      isRead: false,
      hasAttachment: false,
      scanStatus,
      spf: 'none',
      dkim: 'none',
      dmarc: 'none',
    }

    await fetch('http://localhost:3003/internal/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || 'studenttemp-internal-dev-only',
      },
      body: JSON.stringify({
        email: inbox.email,
        sessionId,
        event: 'message:new',
        payload: event,
      }),
    }).catch(() => {})
  } catch {}

  return NextResponse.json({
    ok: true,
    messageId: message.id,
    to: inbox.email,
    from: senderAddress,
    subject: subjectStr,
  })
}
