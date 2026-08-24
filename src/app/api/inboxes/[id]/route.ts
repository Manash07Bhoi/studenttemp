// GET    /api/inboxes/[id] — get a single inbox with message count
// DELETE /api/inboxes/[id] — delete an inbox (cascade messages)
// PATCH  /api/inboxes/[id] — extend expiration
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate, INBOX_LIFETIME_OPTIONS } from '@/lib/mail-utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const inbox = await db.inbox.findUnique({
    where: { id },
    include: { _count: { select: { messages: true } } },
  })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ inbox })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.inbox.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (inbox.expiresAt < new Date()) {
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
    data: { expiresAt: newExpiry },
  })
  return NextResponse.json({ inbox: updated })
}
