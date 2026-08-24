// POST /api/inboxes/[id]/generate — hint endpoint (frontend uses socket directly)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionOrCreate } from '@/lib/mail-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sessionId } = await getSessionOrCreate(req)
  const inbox = await db.inbox.findUnique({ where: { id } })
  if (!inbox || inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (inbox.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Inbox expired' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, message: 'Delivery queued. Expect new mail within ~12 seconds.' })
}
