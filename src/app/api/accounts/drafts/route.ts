// GET /api/accounts/drafts — List drafts
// POST /api/accounts/drafts — Create/update a draft (autosave)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const drafts = await db.draft.findMany({
    where: { accountId },
    orderBy: { lastSavedAt: 'desc' },
  })
  return NextResponse.json({ drafts })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { id, to, cc, bcc, subject, body: draftBody, attachments } = body || {}

  const data = {
    to: String(to || ''),
    cc: String(cc || ''),
    bcc: String(bcc || ''),
    subject: String(subject || ''),
    body: String(draftBody || ''),
    attachments: JSON.stringify(attachments || []),
    lastSavedAt: new Date(),
  }

  if (id) {
    // Update existing draft
    const draft = await db.draft.update({
      where: { id, accountId },
      data,
    })
    return NextResponse.json({ draft })
  }

  // Create new draft
  const draft = await db.draft.create({
    data: { accountId, ...data },
  })
  return NextResponse.json({ draft }, { status: 201 })
}
