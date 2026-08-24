// GET    /api/messages/[id] — full message body
// PATCH  /api/messages/[id] — update isRead / isStarred
// DELETE /api/messages/[id] — delete message
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate } from '@/lib/mail-utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!message.isRead) {
    await db.message.update({ where: { id }, data: { isRead: true } })
  }

  return NextResponse.json({
    message: {
      ...message,
      isRead: true,
      attachments: JSON.parse(message.attachments || '[]'),
    },
    burned: message.inbox.burnOnRead,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => ({}))
  const data: { isRead?: boolean; isStarred?: boolean } = {}
  if (typeof body.isRead === 'boolean') data.isRead = body.isRead
  if (typeof body.isStarred === 'boolean') data.isStarred = body.isStarred
  const updated = await db.message.update({ where: { id }, data })
  return NextResponse.json({ message: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.message.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
