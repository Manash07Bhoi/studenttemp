// POST /api/messages/[id]/report — report a message as abuse
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate } from '@/lib/mail-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
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
  return NextResponse.json({ ok: true })
}
