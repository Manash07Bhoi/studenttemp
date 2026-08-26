// POST /api/webhooks/relay — Webhook receiver for relay provider events (Resend/Brevo)
//
// Phase 13.4: Updates sent_messages.status based on real webhook payloads.
// Supports Resend and Brevo webhook formats.
//
// Security: In production, verify the webhook signature using the provider's
// signing secret. For now, we accept POST with JSON and verify the relayMessageId
// matches an existing sent_messages row.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Resend webhook format: { type: 'email.delivered'|'email.bounced', email: { id: '...' } }
  // Brevo webhook format: { event: 'delivered'|'hard_bounce'|'soft_bounce'|'complaint', message-id: '...' }

  let relayMessageId: string | null = null
  let eventType: string = ''

  // Resend format
  if (body?.email?.id) {
    relayMessageId = body.email.id
    eventType = body.type || ''
  }
  // Brevo format
  else if (body?.['message-id']) {
    relayMessageId = body['message-id']
    eventType = body.event || ''
  }

  if (!relayMessageId) {
    return NextResponse.json({ error: 'No message ID found in webhook payload' }, { status: 400 })
  }

  // Find the sent message by relayMessageId
  const sentMessage = await db.sentMessage.findFirst({
    where: { relayMessageId },
  })
  if (!sentMessage) {
    // Not a tracked message (might be a Temp Mode send) — acknowledge but don't error
    return NextResponse.json({ ok: true, message: 'Message not tracked (Temp Mode send)' })
  }

  // Map event type to status
  const isDelivered = /delivered/i.test(eventType)
  const isBounce = /bounce/i.test(eventType)
  const isComplaint = /complaint|spam/i.test(eventType)

  if (isDelivered) {
    await db.sentMessage.update({
      where: { id: sentMessage.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
      },
    })
    console.info(`[webhook] message ${sentMessage.id} marked delivered`)
  } else if (isBounce) {
    await db.sentMessage.update({
      where: { id: sentMessage.id },
      data: {
        status: 'bounced',
        bouncedAt: new Date(),
        bounceReason: body?.reason || body?.error || eventType,
      },
    })
    console.info(`[webhook] message ${sentMessage.id} marked bounced`)
  } else if (isComplaint) {
    await db.sentMessage.update({
      where: { id: sentMessage.id },
      data: {
        status: 'complained',
      },
    })
    console.info(`[webhook] message ${sentMessage.id} marked complained`)
  }

  return NextResponse.json({ ok: true })
}
