// GET /api/accounts/vacation — Get vacation responder settings
// PUT /api/accounts/vacation — Update vacation responder
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const vr = await db.vacationResponder.findUnique({ where: { accountId } })
  return NextResponse.json({ vacationResponder: vr })
}

export async function PUT(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { enabled, startDate, endDate, subject, body: vrBody, contactsOnly } = body || {}

  const vr = await db.vacationResponder.upsert({
    where: { accountId },
    update: {
      enabled: enabled ?? false,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      subject: subject || '',
      body: vrBody || '',
      contactsOnly: contactsOnly ?? false,
    },
    create: {
      accountId,
      enabled: enabled ?? false,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      subject: subject || '',
      body: vrBody || '',
      contactsOnly: contactsOnly ?? false,
    },
  })
  return NextResponse.json({ vacationResponder: vr })
}
