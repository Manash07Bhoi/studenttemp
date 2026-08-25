// GET /api/accounts/labels — List labels
// POST /api/accounts/labels — Create a custom label
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const labels = await db.label.findMany({
    where: { accountId },
    orderBy: [{ isSystemLabel: 'desc' }, { name: 'asc' }],
    include: { childLabels: true },
  })
  return NextResponse.json({ labels })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { name, color = '#10b981', retentionDays, parentLabelId } = body || {}
  if (!name) return NextResponse.json({ error: 'Label name required' }, { status: 400 })

  const existing = await db.label.findUnique({
    where: { accountId_name: { accountId, name: String(name) } },
  })
  if (existing) return NextResponse.json({ error: 'Label already exists' }, { status: 409 })

  const label = await db.label.create({
    data: {
      accountId,
      name: String(name),
      color,
      retentionDays: retentionDays || null,
      parentLabelId: parentLabelId || null,
    },
  })
  return NextResponse.json({ label }, { status: 201 })
}
