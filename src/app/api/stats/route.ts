// GET /api/stats — usage stats for the current session + global
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate } from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getSessionOrCreate(req)
  const now = new Date()
  const [activeInboxes, totalInboxes, totalMessages, unreadMessages, globalInboxes, globalMessages] = await Promise.all([
    db.inbox.count({ where: { sessionId, expiresAt: { gt: now } } }),
    db.inbox.count({ where: { sessionId } }),
    db.message.count({ where: { inbox: { sessionId } } }),
    db.message.count({ where: { inbox: { sessionId }, isRead: false } }),
    db.inbox.count({ where: { expiresAt: { gt: now } } }),
    db.message.count(),
  ])

  return NextResponse.json({
    session: { activeInboxes, totalInboxes, totalMessages, unreadMessages },
    global: { activeInboxes: globalInboxes, totalMessages: globalMessages },
  })
}
