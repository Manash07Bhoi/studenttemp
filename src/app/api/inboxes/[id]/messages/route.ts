// GET /api/inboxes/[id]/messages — list messages for an inbox
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate } from '@/lib/mail-utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const messages = await db.message.findMany({
    where: { inboxId: id },
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      subject: true,
      previewText: true,
      isRead: true,
      isStarred: true,
      receivedAt: true,
      category: true,
      hasAttachment: true,
      scanStatus: true,
      spf: true,
      dkim: true,
      dmarc: true,
      externalResourcesBlocked: true,
      isReported: true,
    },
    take: 100,
  })

  const unread = messages.filter(m => !m.isRead).length
  return NextResponse.json({ messages, unread, total: messages.length, inbox })
}
