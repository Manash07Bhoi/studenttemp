// POST /api/notifications/subscribe — register a Web Push subscription (real PushManager)
// DELETE /api/notifications/subscribe — unsubscribe
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { endpoint, keys } = body || {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }
  await db.notificationSubscription.deleteMany({ where: { sessionId, endpoint } })
  const sub = await db.notificationSubscription.create({
    data: {
      sessionId,
      endpoint,
      keys: JSON.stringify(keys),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  return NextResponse.json({ ok: true, id: sub.id })
}

export async function DELETE(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { endpoint } = body || {}
  if (endpoint) {
    await db.notificationSubscription.deleteMany({ where: { sessionId, endpoint } })
  } else {
    await db.notificationSubscription.deleteMany({ where: { sessionId } })
  }
  return NextResponse.json({ ok: true })
}
