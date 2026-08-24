// POST /api/inboxes — create a new inbox (random or custom)
// GET  /api/inboxes — list session's active inboxes
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  DOMAINS,
  INBOX_LIFETIME_OPTIONS,
  generateLocalPart,
  validateLocalPart,
  buildEmailAddress,
  getSessionOrCreate,
  checkInboxQuota,
  QUOTAS,
} from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getSessionOrCreate(req)
  const inboxes = await db.inbox.findMany({
    where: { sessionId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  })
  return NextResponse.json({ inboxes })
}

export async function POST(req: NextRequest) {
  const { sessionId, setCookie } = await getSessionOrCreate(req)
  const body = await req.json().catch(() => ({}))
  const {
    customLocalPart,
    domain,
    lifetimeMinutes,
    category = 'general',
    burnOnRead = false,
  } = body || {}

  const validDomain = DOMAINS.find(d => d.domain === domain)
  if (!validDomain) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  const lifetime = Number(lifetimeMinutes) || INBOX_LIFETIME_OPTIONS.find(o => o.default)?.value || 10
  if (!INBOX_LIFETIME_OPTIONS.some(o => o.value === lifetime)) {
    return NextResponse.json({ error: 'Invalid lifetime' }, { status: 400 })
  }

  let localPart: string | undefined
  if (customLocalPart && typeof customLocalPart === 'string') {
    const normalized = customLocalPart.toLowerCase().trim()
    const validation = validateLocalPart(normalized)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }
    const existing = await db.inbox.findFirst({
      where: { localPart: normalized, domain: validDomain.domain },
    })
    if (existing && existing.expiresAt > new Date()) {
      return NextResponse.json({ error: 'This address is already taken' }, { status: 409 })
    }
    if (existing && existing.expiresAt < new Date()) {
      const cooldownEnd = new Date(existing.expiresAt.getTime() + 5 * 60 * 1000)
      if (cooldownEnd > new Date()) {
        return NextResponse.json(
          { error: 'This address is in a cooldown period after recent expiry. Try again shortly.' },
          { status: 409 }
        )
      }
      await db.inbox.delete({ where: { id: existing.id } })
    }
    localPart = normalized
  } else {
    let attempts = 0
    while (attempts < 10) {
      const candidate = generateLocalPart()
      const exists = await db.inbox.findUnique({ where: { email: buildEmailAddress(candidate, validDomain.domain) } })
      if (!exists) {
        localPart = candidate
        break
      }
      attempts++
    }
    if (!localPart) {
      return NextResponse.json({ error: 'Failed to generate unique address, please retry' }, { status: 500 })
    }
  }

  const quota = await checkInboxQuota(sessionId)
  if (!quota.ok) {
    return NextResponse.json(
      { error: `You can have at most ${QUOTAS.MAX_ACTIVE_INBOXES_PER_SESSION} active inboxes. Delete one first.` },
      { status: 409 }
    )
  }

  const email = buildEmailAddress(localPart, validDomain.domain)
  const expiresAt = new Date(Date.now() + lifetime * 60 * 1000)

  const inbox = await db.inbox.create({
    data: {
      email,
      localPart,
      domain: validDomain.domain,
      isCustom: !!customLocalPart,
      category,
      expiresAt,
      sessionId,
      burnOnRead: !!burnOnRead,
    },
    include: { _count: { select: { messages: true } } },
  })

  const res = NextResponse.json({ inbox }, { status: 201 })
  if (setCookie) res.headers.set('set-cookie', setCookie)
  return res
}
