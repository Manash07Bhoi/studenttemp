// GET /api/messages/[id]/attachments/[attId] — download a real attachment file
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'
import { readFileSync } from 'fs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; attId: string }> }) {
  const { id, attId } = await params
  const { sessionId } = await getOrCreateSession(req)
  const message = await db.message.findUnique({
    where: { id },
    include: { inbox: true, attachments: { where: { id: attId } } },
  })
  if (!message || message.inbox.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const att = message.attachments[0]
  if (!att) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  // Gate download on scan status (real ClamAV integration in prod)
  if (att.scanStatus === 'quarantined') {
    return NextResponse.json({ error: 'This file was flagged and cannot be downloaded.' }, { status: 403 })
  }

  const buf = readFileSync(att.storageKey)
  return new NextResponse(buf, {
    headers: {
      'Content-Type': att.mimeType,
      'Content-Disposition': `attachment; filename="${att.filename}"`,
      'Content-Length': String(att.sizeBytes),
    },
  })
}
