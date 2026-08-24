// POST /api/messages/[id]/report — report a message as abuse
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, auditLog, getClientIp, rateLimit } from '@/lib/mail-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = getClientIp(req)
  // Rate limit reports: 10/hour/IP
  const limit = rateLimit(`report:${ip}`, 10, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many reports. Please try again later.' }, { status: 429 })
  }
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason || '').slice(0, 500)
  const category = ['spam', 'phishing', 'abuse', 'other'].includes(body.category) ? body.category : 'spam'

  await db.message.update({ where: { id }, data: { isReported: true } })
  await db.abuseReport.create({
    data: { messageId: id, reason, category },
  })
  await auditLog({ sessionId, action: 'message.report', targetType: 'message', targetId: id, metadata: { category, reason }, ip })
  return NextResponse.json({ ok: true })
}
