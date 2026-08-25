// POST /api/notifications/send — send a real Web Push notification to all session subscriptions
// Called by the mail-service (or manually) when a new message arrives.
// Uses real VAPID keys (generated via npx web-push generate-vapid-keys).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { title, body: messageBody, inboxId } = body || {}

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Get all subscriptions for this session
  const subscriptions = await db.notificationSubscription.findMany({
    where: { sessionId, expiresAt: { gt: new Date() } },
  })

  if (subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions found' })
  }

  // Check VAPID keys are configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  // Dynamic import of web-push (ESM/CJS interop fix)
  const webpush = (await import('web-push')).default || (await import('web-push'))
  webpush.setVapidDetails('mailto:noreply@studenttemp.example', publicKey, privateKey)

  // Per SECURITY.md §35: payload contains NO message content
  const payload = JSON.stringify({
    title: title || 'New email received',
    body: messageBody || 'You have new mail in your StudentTemp inbox',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: inboxId ? `inbox-${inboxId}` : 'studenttemp-new-mail',
    data: { inboxId, url: '/' },
    requireInteraction: false,
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: JSON.parse(sub.keys),
      }
      return webpush.sendNotification(subscription, payload)
    })
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Clean up expired subscriptions (410 Gone / 404 Not Found)
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      const err = (results[i] as PromiseRejectedResult).reason
      if (err && (err.statusCode === 410 || err.statusCode === 404)) {
        await db.notificationSubscription.delete({ where: { id: subscriptions[i].id } }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, sent: succeeded, failed, total: subscriptions.length })
}
