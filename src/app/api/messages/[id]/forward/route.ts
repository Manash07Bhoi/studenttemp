// POST /api/messages/[id]/forward — forward a message to another email address via real SMTP
// Sends a copy of the original message (with Fwd: prefix) from the inbox that owns it.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, getClientIp, rateLimit, auditLog } from '@/lib/mail-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = getClientIp(req)
  const limit = rateLimit(`send-mail:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit: max 5 sent mails per hour.' }, { status: 429 })
  }
  const { sessionId } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { to, note } = body || {}

  if (!to || typeof to !== 'string') {
    return NextResponse.json({ error: 'Recipient address is required' }, { status: 400 })
  }
  const toAddr = to.toLowerCase().trim()
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(toAddr)) {
    return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
  }

  // Load the original message + verify ownership
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Original message not found' }, { status: 404 })
  }
  if (message.inbox.status !== 'active' || message.inbox.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Inbox expired' }, { status: 400 })
  }

  // Build forwarded message
  const fwdSubject = message.subject.toLowerCase().startsWith('fwd:')
    ? message.subject
    : `Fwd: ${message.subject}`

  const fwdText = note?.trim()
    ? `${note.trim()}\n\n---------- Forwarded message ----------\nFrom: ${message.senderDisplayName || message.senderAddress}\nSubject: ${message.subject}\n\n${message.bodyText}`
    : `---------- Forwarded message ----------\nFrom: ${message.senderDisplayName || message.senderAddress}\nSubject: ${message.subject}\n\n${message.bodyText}`

  const fwdHtml = note?.trim()
    ? `<div><p>${note.trim().replace(/\n/g, '<br>')}</p><hr><p><small>---------- Forwarded message ----------</small><br>From: ${message.senderDisplayName || message.senderAddress}<br>Subject: ${message.subject}</p>${message.bodyHtml || `<pre>${message.bodyText}</pre>`}</div>`
    : `<div><hr><p><small>---------- Forwarded message ----------</small><br>From: ${message.senderDisplayName || message.senderAddress}<br>Subject: ${message.subject}</p>${message.bodyHtml || `<pre>${message.bodyText}</pre>`}</div>`

  // Send via real SMTP
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
      from: message.inbox.email,
      to: toAddr,
      subject: fwdSubject,
      text: fwdText,
      html: fwdHtml,
    })

    await auditLog({
      sessionId,
      action: 'message.forward',
      targetType: 'message',
      targetId: id,
      metadata: { to: toAddr, subject: fwdSubject, messageId: info.messageId },
      ip,
    })

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      response: info.response,
      to: toAddr,
      subject: fwdSubject,
    })
  } catch (e) {
    console.error('[forward] error:', e)
    return NextResponse.json({ error: 'Failed to forward: ' + (e as Error).message }, { status: 500 })
  }
}
