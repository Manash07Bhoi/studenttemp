// POST /api/webhooks/relay — Webhook receiver for relay provider events (Resend/Brevo)
//
// Security: Verifies webhook signatures to prevent forged delivery/bounce events.
// Resend: verifies using the Resend webhook signing secret
// Brevo: verifies using the Brevo webhook signature
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

// Verify Resend webhook signature
function verifyResendSignature(payload: string, signature: string, timestamp: string): boolean {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) return false // No secret configured — reject
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// Verify Brevo webhook signature
function verifyBrevoSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.BREVO_WEBHOOK_SECRET
  if (!webhookSecret) return false
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Get signature headers
  const resendSignature = req.headers.get('svix-signature') || req.headers.get('resend-signature')
  const resendTimestamp = req.headers.get('svix-timestamp') || req.headers.get('resend-timestamp')
  const brevoSignature = req.headers.get('brevo-signature')

  // If no webhook secret is configured, check for a shared secret in the URL
  // This is a fallback for development/testing only
  const url = new URL(req.url)
  const sharedSecret = url.searchParams.get('secret')
  const configuredSecret = process.env.WEBHOOK_SHARED_SECRET

  const isAuthorized = (() => {
    // Method 1: Resend signature verification
    if (resendSignature && resendTimestamp) {
      return verifyResendSignature(rawBody, resendSignature, resendTimestamp)
    }
    // Method 2: Brevo signature verification
    if (brevoSignature) {
      return verifyBrevoSignature(rawBody, brevoSignature)
    }
    // Method 3: Shared secret in query param (fallback for dev/testing)
    if (configuredSecret && sharedSecret === configuredSecret) {
      return true
    }
    // If no webhook secrets are configured at all, reject
    return false
  })()

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend format: { type: 'email.delivered'|'email.bounced', email: { id: '...' } }
  let relayMessageId: string | null = null
  let eventType: string = ''

  // Support for email.received
  if (body?.type === 'email.received') {
    eventType = 'email.received'
    // Forward the payload to the internal mail service endpoint
    try {
      const internalMailHost = process.env.INTERNAL_MAIL_SERVICE_URL || 'http://studenttemp-mail:3003'
      const internalSecret = process.env.INTERNAL_API_SECRET
      if (!internalSecret) {
        console.error('[webhook] INTERNAL_API_SECRET not set, cannot forward to mail service')
        return NextResponse.json({ error: 'Internal configuration error' }, { status: 500 })
      }

      const forwardRes = await fetch(`${internalMailHost}/api/internal/ingest-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`
        },
        body: rawBody
      })

      if (!forwardRes.ok) {
        const errorText = await forwardRes.text()
        console.error(`[webhook] Failed to forward email.received: ${forwardRes.status} ${errorText}`)
        return NextResponse.json({ error: 'Failed to process inbound message' }, { status: forwardRes.status })
      }

      console.info(`[webhook] Successfully forwarded email.received to mail service`)
      return NextResponse.json({ ok: true, forwarded: true })
    } catch (e) {
      console.error('[webhook] Exception forwarding email.received:', e)
      return NextResponse.json({ error: 'Internal forwarding error' }, { status: 500 })
    }
  }

  if (body?.email?.id) {
    relayMessageId = body.email.id
    eventType = body.type || ''
  } else if (body?.['message-id']) {
    relayMessageId = body['message-id']
    eventType = body.event || ''
  }

  if (!relayMessageId) {
    return NextResponse.json({ error: 'No message ID in payload' }, { status: 400 })
  }

  const sentMessage = await db.sentMessage.findFirst({ where: { relayMessageId } })
  if (!sentMessage) {
    return NextResponse.json({ ok: true, message: 'Message not tracked' })
  }

  const isDelivered = /delivered/i.test(eventType)
  const isBounce = /bounce/i.test(eventType)
  const isComplaint = /complaint|spam/i.test(eventType)

  if (isDelivered) {
    await db.sentMessage.update({
      where: { id: sentMessage.id },
      data: { status: 'delivered', deliveredAt: new Date() },
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
      data: { status: 'complained' },
    })
    console.info(`[webhook] message ${sentMessage.id} marked complained`)
  }

  return NextResponse.json({ ok: true })
}
