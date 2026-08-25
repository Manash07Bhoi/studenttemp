// GET /api/inboxes/[id]/messages — list messages for an inbox
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found', code: 'INBOX_NOT_FOUND' }, { status: 404 })
  }
  // GAP L1: Inbox expired mid-request — return specific error code (not generic 404/500)
  if (inbox.status !== 'active' || inbox.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Inbox expired', code: 'INBOX_EXPIRED' }, { status: 410 })
  }

  const messages = await db.message.findMany({
    where: { inboxId: id },
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      publicId: true,
      senderAddress: true,
      senderDisplayName: true,
      subject: true,
      previewText: true,
      isRead: true,
      isStarred: true,
      receivedAt: true,
      hasAttachment: true,
      scanStatus: true,
      authSpf: true,
      authDkim: true,
      authDmarc: true,
      externalResourcesBlocked: true,
      isReported: true,
      sizeBytes: true,
    },
    take: 100,
  })

  const unread = messages.filter(m => !m.isRead).length
  return NextResponse.json({
    messages: messages.map(m => ({
      ...m,
      fromEmail: m.senderAddress,
      fromName: m.senderDisplayName || m.senderAddress,
      spf: m.authSpf,
      dkim: m.authDkim,
      dmarc: m.authDmarc,
      category: inbox.category,
    })),
    unread,
    total: messages.length,
    inbox,
  })
}
