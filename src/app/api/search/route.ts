// GET /api/search?q=<query> — inbox-wide global search across ALL session inboxes
// Returns matching messages from every active/expired inbox the session owns.
// Per GAPS.md recommendation: "inbox-wide search across all inboxes".
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], total: 0 })
  }

  // Find all inboxes for this session (active + recently expired)
  const inboxes = await db.inbox.findMany({
    where: { sessionId },
    select: { id: true, email: true, status: true, expiresAt: true },
  })

  if (inboxes.length === 0) {
    return NextResponse.json({ results: [], total: 0 })
  }

  const inboxIds = inboxes.map((i) => i.id)

  // Search messages across all session inboxes
  // SQLite LIKE is case-insensitive by default for ASCII
  const messages = await db.message.findMany({
    where: {
      inboxId: { in: inboxIds },
      OR: [
        { subject: { contains: q } },
        { senderAddress: { contains: q } },
        { senderDisplayName: { contains: q } },
        { previewText: { contains: q } },
        { bodyText: { contains: q } },
      ],
    },
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
      inboxId: true,
    },
    take: 50,
  })

  // Attach the inbox email to each result
  const inboxMap = new Map(inboxes.map((i) => [i.id, i]))
  const results = messages.map((m) => {
    const inbox = inboxMap.get(m.inboxId)
    return {
      ...m,
      fromEmail: m.senderAddress,
      fromName: m.senderDisplayName || m.senderAddress,
      spf: m.authSpf,
      dkim: m.authDkim,
      dmarc: m.authDmarc,
      category: 'general',
      inboxEmail: inbox?.email || '',
      inboxStatus: inbox?.status || 'unknown',
      inboxExpired: inbox ? inbox.expiresAt < new Date() : true,
    }
  })

  return NextResponse.json({ results, total: results.length })
}
