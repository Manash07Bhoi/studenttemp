// GET /api/accounts/filters — List filters
// POST /api/accounts/filters — Create a filter
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const filters = await db.filter.findMany({
    where: { accountId },
    orderBy: { priorityOrder: 'asc' },
  })
  return NextResponse.json({ filters })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { conditions, actions, stopProcessing = false, priorityOrder = 0 } = body || {}

  const filter = await db.filter.create({
    data: {
      accountId,
      conditions: JSON.stringify(conditions || []),
      actions: JSON.stringify(actions || []),
      stopProcessing,
      priorityOrder,
    },
  })
  return NextResponse.json({ filter }, { status: 201 })
}

// DELETE /api/accounts/filters — Delete a filter
export async function DELETE(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Filter id required' }, { status: 400 })

  const existing = await db.filter.findUnique({ where: { id } })
  if (!existing || existing.accountId !== accountId) {
    return NextResponse.json({ error: 'Filter not found' }, { status: 404 })
  }

  await db.filter.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
