// GET    /api/messages/[id] — full message body + real auth details
// PATCH  /api/messages/[id] — update isRead / isStarred
// DELETE /api/messages/[id] — delete message (+ attachment files)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, auditLog, getClientIp } from '@/lib/mail-utils'
import { existsSync, unlinkSync } from 'fs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true, attachments: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Mark as read on first open
  if (!message.isRead) {
    await db.message.update({ where: { id }, data: { isRead: true } })
    await db.inbox.update({ where: { id: message.inboxId }, data: { lastActivityAt: new Date() } })
  }

  // Parse real auth details
  let authDetails = {}
  try { authDetails = JSON.parse(message.authDetails || '{}') } catch {}

  return NextResponse.json({
    message: {
      ...message,
      isRead: true,
      fromEmail: message.senderAddress,
      fromName: message.senderDisplayName || message.senderAddress,
      spf: message.authSpf,
      dkim: message.authDkim,
      dmarc: message.authDmarc,
      authDetails,
      category: message.inbox.category,
      // Don't leak internal IDs to client — use publicId
      id: message.id, // still needed for PATCH/DELETE
    },
    burned: message.inbox.burnOnRead,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({ where: { id }, include: { inbox: true } })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const data: { isRead?: boolean; isStarred?: boolean } = {}
  if (typeof body.isRead === 'boolean') data.isRead = body.isRead
  if (typeof body.isStarred === 'boolean') data.isStarred = body.isStarred
  const updated = await db.message.update({ where: { id }, data })
  if (body.isRead === true || body.isRead === false) {
    await auditLog({ sessionId, action: `message.${body.isRead ? 'read' : 'unread'}`, targetType: 'message', targetId: id, ip: getClientIp(req) })
  }
  return NextResponse.json({ message: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true, attachments: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // Delete attachment files from disk
  for (const att of message.attachments) {
    if (existsSync(att.storageKey)) {
      try { unlinkSync(att.storageKey) } catch {}
    }
  }
  await db.message.delete({ where: { id } })
  await db.inbox.update({
    where: { id: message.inboxId },
    data: { messageCount: { decrement: 1 }, lastActivityAt: new Date() },
  })
  await auditLog({ sessionId, action: 'message.delete', targetType: 'message', targetId: id, ip: getClientIp(req) })
  return NextResponse.json({ ok: true })
}
