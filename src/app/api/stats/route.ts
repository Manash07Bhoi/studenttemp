// GET /api/stats — real usage stats for the current session + global
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const now = new Date()
  const [activeInboxes, totalInboxes, totalMessages, unreadMessages, globalInboxes, globalMessages, domains] = await Promise.all([
    db.inbox.count({ where: { sessionId, status: 'active', expiresAt: { gt: now } } }),
    db.inbox.count({ where: { sessionId } }),
    db.message.count({ where: { inbox: { sessionId } } }),
    db.message.count({ where: { inbox: { sessionId }, isRead: false } }),
    db.inbox.count({ where: { status: 'active', expiresAt: { gt: now } } }),
    db.message.count(),
    db.domain.count({ where: { active: true } }),
  ])

  return NextResponse.json({
    session: { activeInboxes, totalInboxes, totalMessages, unreadMessages },
    global: { activeInboxes: globalInboxes, totalMessages: globalMessages, domains },
  })
}
