// POST /api/inboxes/[id]/test-mail — send a real test email to this inbox via SMTP
// This runs server-side and uses nodemailer to send a real email to the inbox
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, getClientIp, rateLimit } from '@/lib/mail-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = getClientIp(req)
  // Rate limit: 5 test emails per hour per IP
  const limit = rateLimit(`test-mail:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many test emails. Please wait a few minutes.' }, { status: 429 })
  }

  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 })
  }
  if (inbox.status !== 'active' || inbox.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Inbox expired' }, { status: 400 })
  }

  try {
    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host: process.env.SMTP_RELAY_HOST || 'localhost',
      port: Number(process.env.SMTP_RELAY_PORT) || 2525,
      secure: false,
      tls: { rejectUnauthorized: false },
    })

    const info = await transporter.sendMail({
      from: 'noreply@studenttemp.dev',
      to: inbox.email,
      subject: '✅ Test email — your inbox is working!',
      text: `Hello! This is a test email sent to your StudentTemp inbox: ${inbox.email}\n\nIf you can read this, mail delivery is working correctly.\n\nThe inbox will expire at: ${inbox.expiresAt}\n\n— StudentTemp`,
      html: `<div style="font-family:Arial;padding:24px;max-width:560px;margin:0 auto">
        <h2 style="color:#10b981">✅ Test Email Received!</h2>
        <p>Your StudentTemp inbox is working correctly.</p>
        <p><strong>Inbox:</strong> <span style="font-family:monospace">${inbox.email}</span></p>
        <p><strong>Expires:</strong> ${new Date(inbox.expiresAt).toLocaleString()}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="color:#999;font-size:12px">This is an automated test email from StudentTemp. If you see this in your Messages tab, real SMTP delivery is working.</p>
      </div>`,
    })

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      response: info.response,
      to: inbox.email,
    })
  } catch (e) {
    console.error('[test-mail] error:', e)
    return NextResponse.json({ error: 'Failed to send test email: ' + (e as Error).message }, { status: 500 })
  }
}
