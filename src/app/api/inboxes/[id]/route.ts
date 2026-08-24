// GET    /api/inboxes/[id] — get a single inbox
// DELETE /api/inboxes/[id] — delete an inbox (cascade messages + attachments on disk)
// PATCH  /api/inboxes/[id] — extend expiration
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession, INBOX_LIFETIME_OPTIONS, auditLog, getClientIp } from '@/lib/mail-utils'
import { existsSync, unlinkSync } from 'fs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({
    where: { id },
    include: { domain: true, _count: { select: { messages: true } } },
  })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ inbox })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ip = getClientIp(req)
  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({ where: { id }, include: { messages: { include: { attachments: true } } } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // Delete attachment files from disk
  for (const msg of inbox.messages) {
    for (const att of msg.attachments) {
      if (existsSync(att.storageKey)) {
        try { unlinkSync(att.storageKey) } catch {}
      }
    }
  }
  await db.inbox.update({ where: { id }, data: { status: 'deleted' } })
  await db.inbox.delete({ where: { id } })
  await auditLog({ sessionId, action: 'inbox.delete', targetType: 'inbox', targetId: id, metadata: { email: inbox.email }, ip })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getOrCreateSession(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (inbox.expiresAt < new Date() || inbox.status !== 'active') {
    return NextResponse.json({ error: 'Inbox already expired' }, { status: 400 })
  }
  const body = await req.json().catch(() => ({}))
  const extendMinutes = Number(body.extendMinutes) || 10
  const valid = INBOX_LIFETIME_OPTIONS.some(o => o.value === extendMinutes)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid extension duration' }, { status: 400 })
  }
  const base = inbox.expiresAt > new Date() ? inbox.expiresAt : new Date()
  const newExpiry = new Date(base.getTime() + extendMinutes * 60 * 1000)
  const updated = await db.inbox.update({
    where: { id },
    data: { expiresAt: newExpiry, lastActivityAt: new Date() },
    include: { domain: true, _count: { select: { messages: true } } },
  })
  await auditLog({ sessionId, action: 'inbox.extend', targetType: 'inbox', targetId: id, metadata: { extendMinutes, newExpiry }, ip: getClientIp(req) })
  return NextResponse.json({ inbox: updated })
}
