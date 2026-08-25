// GET /api/accounts/inboxes — List account inboxes (permanent + time-limited)
// POST /api/accounts/inboxes — Create a new time-limited mailbox for the account
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId, getExpiryForPlan } from '@/lib/auth-utils'
import { validateLocalPart, generateLocalPart, buildEmailAddress, getClientIp, rateLimit } from '@/lib/mail-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const inboxes = await db.inbox.findMany({
    where: { accountId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { domain: true, _count: { select: { messages: true } } },
  })
  return NextResponse.json({ inboxes })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const ip = getClientIp(req)
  const limit = rateLimit(`account-inbox:${ip}`, 10, 60 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { customLocalPart, domain: domainName, planDuration = '30d' } = body || {}

  const domainRow = await db.domain.findFirst({ where: { domain: domainName, active: true } })
  if (!domainRow) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  let localPart: string
  let isCustom = false

  if (customLocalPart) {
    const normalized = String(customLocalPart).toLowerCase().trim()
    const validation = validateLocalPart(normalized)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }
    const conflict = await db.inbox.findFirst({
      where: { localPart: normalized, domainId: domainRow.id, status: 'active' },
    })
    if (conflict) {
      return NextResponse.json({ error: 'Address already taken' }, { status: 409 })
    }
    localPart = normalized
    isCustom = true
  } else {
    localPart = generateLocalPart()
  }

  const email = buildEmailAddress(localPart, domainRow.domain)
  const expiresAt = getExpiryForPlan(planDuration)
  const isPermanent = planDuration === 'permanent'

  const inbox = await db.inbox.create({
    data: {
      email,
      localPart,
      domainId: domainRow.id,
      isCustomAlias: isCustom,
      status: 'active',
      isPermanent,
      planDuration,
      expiresAt,
      accountId,
      maxMessages: 10000,
    },
    include: { domain: true },
  })

  return NextResponse.json({ inbox }, { status: 201 })
}
