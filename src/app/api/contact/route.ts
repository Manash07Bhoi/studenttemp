// POST /api/contact — Contact/Support form submission
// Per GAP M8: simple static contact form with honeypot + rate limiting
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClientIp, rateLimit, auditLog, getOrCreateSession } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  // Rate limit: 3 messages/hour/IP
  const limit = rateLimit(`contact:${ip}`, 3, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, email, subject, message, website } = body || {}

  // Honeypot field — if filled, it's a bot
  if (website) {
    // Pretend success to not tip off the bot
    return NextResponse.json({ ok: true })
  }

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (String(name).length > 100 || String(email).length > 200 || String(subject).length > 200 || String(message).length > 5000) {
    return NextResponse.json({ error: 'Field too long' }, { status: 400 })
  }
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(email))) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const { sessionId } = await getOrCreateSession(req)

  // Store as an audit log entry (not a dedicated table for MVP)
  await auditLog({
    sessionId,
    action: 'contact.submit',
    metadata: { name, email, subject, messagePreview: String(message).slice(0, 200) },
    ip,
  })

  return NextResponse.json({ ok: true })
}
