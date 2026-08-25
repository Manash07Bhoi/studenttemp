// GET /api/accounts/contacts — List contacts
// POST /api/accounts/contacts — Add a contact
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const contacts = await db.contact.findMany({
    where: { accountId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ contacts })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { name, email, groupName } = body || {}
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const contact = await db.contact.create({
    data: { accountId, name: String(name), email: String(email), groupName: groupName || null },
  })
  return NextResponse.json({ contact }, { status: 201 })
}
