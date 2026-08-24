// POST /api/messages/[id]/reply — reply to a message via real SMTP
// Sends a real email FROM the inbox that received the original message
// TO the original sender, with proper In-Reply-To / References headers.
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
  const { text, html } = body || {}

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
  }
  if (text.length > 50_000) {
    return NextResponse.json({ error: 'Reply too long (max 50,000 chars)' }, { status: 400 })
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

    const replySubject = message.subject.toLowerCase().startsWith('re:') ? message.subject : `Re: ${message.subject}`
    const replyText = `${text}\n\n--- Original Message ---\nFrom: ${message.senderDisplayName || message.senderAddress}\nSubject: ${message.subject}\n\n${(message.bodyText || '').split('\n').slice(0, 10).join('\n')}`

    const info = await transporter.sendMail({
      from: message.inbox.email,
      to: message.senderAddress,
      subject: replySubject,
      text: replyText,
      html: html ? String(html) : undefined,
      inReplyTo: message.smtpMessageId || undefined,
      references: message.smtpMessageId || undefined,
    })

    await auditLog({
      sessionId,
      action: 'message.reply',
      targetType: 'message',
      targetId: id,
      metadata: { to: message.senderAddress, subject: replySubject, messageId: info.messageId },
      ip,
    })

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      response: info.response,
      to: message.senderAddress,
      subject: replySubject,
    })
  } catch (e) {
    console.error('[reply] error:', e)
    return NextResponse.json({ error: 'Failed to send reply: ' + (e as Error).message }, { status: 500 })
  }
}
