// GET /api/messages/[id]/export — download a single message as a real .eml file
// Per GAPS.md M4: "export as a .zip containing .eml files per message (standard, portable format)"
// Here we export a single message as .eml (RFC 5322 format).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

function rfc2822Date(d: Date): string {
  return d.toUTCString().replace('GMT', '+0000')
}

function buildEml(opts: {
  messageId: string | null
  from: string
  fromName: string | null
  to: string
  subject: string
  date: Date
  text: string
  html: string
}): string {
  const { messageId, from, fromName, to, subject, date, text, html } = opts
  const lines: string[] = []
  lines.push(`Date: ${rfc2822Date(date)}`)
  lines.push(`From: ${fromName ? `"${fromName}" <${from}>` : from}`)
  lines.push(`To: ${to}`)
  lines.push(`Subject: ${subject}`)
  if (messageId) lines.push(`Message-ID: ${messageId}`)
  lines.push('MIME-Version: 1.0')
  if (html) {
    const boundary = `----=_StudentTemp_${Date.now()}`
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(text || '(no plain text body)')
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(html)
    lines.push('')
    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(text || '(no body)')
  }
  return lines.join('\r\n')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const eml = buildEml({
    messageId: message.smtpMessageId,
    from: message.senderAddress,
    fromName: message.senderDisplayName,
    to: message.inbox.email,
    subject: message.subject,
    date: message.receivedAt,
    text: message.bodyText,
    html: message.bodyHtml,
  })

  const safeSubject = message.subject.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  return new NextResponse(eml, {
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="${safeSubject}.eml"`,
      'Content-Length': String(Buffer.byteLength(eml, 'utf8')),
    },
  })
}
