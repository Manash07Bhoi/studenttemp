// POST /api/inboxes — create a new inbox (random or custom)
// GET  /api/inboxes — list session's active inboxes
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  INBOX_LIFETIME_OPTIONS,
  generateLocalPart,
  validateLocalPart,
  buildEmailAddress,
  getOrCreateSession,
  checkInboxQuota,
  QUOTAS,
  rateLimit,
  getClientIp,
  auditLog,
  hashToken,
} from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const inboxes = await db.inbox.findMany({
    where: { sessionId, status: 'active', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: { domain: true, _count: { select: { messages: true } } },
  })
  return NextResponse.json({ inboxes })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  // Rate limit inbox creation: 10/hour/IP, 30/day/IP
  const hourLimit = rateLimit(`create-inbox:${ip}`, 10, 60 * 60 * 1000)
  if (!hourLimit.ok) {
    return NextResponse.json({ error: 'Too many inboxes created. Please try again later.' }, { status: 429 })
  }
  const { sessionId, setCookie } = await getOrCreateSession(req)
  const body = await req.json().catch(() => ({}))
  const { customLocalPart, domain: domainName, lifetimeMinutes, category = 'general', burnOnRead = false } = body || {}

  const domainRow = await db.domain.findFirst({ where: { domain: domainName, active: true } })
  if (!domainRow) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  const lifetime = Number(lifetimeMinutes) || INBOX_LIFETIME_OPTIONS.find(o => 'default' in o && o.default)?.value || 10
  if (!INBOX_LIFETIME_OPTIONS.some(o => o.value === lifetime)) {
    return NextResponse.json({ error: 'Invalid lifetime' }, { status: 400 })
  }

  let localPart: string
  let isCustom = false
  if (customLocalPart && typeof customLocalPart === 'string') {
    const normalized = customLocalPart.toLowerCase().trim()
    // Rate limit alias checks: 20/min/IP
    const checkLimit = rateLimit(`check-alias:${ip}`, 20, 60 * 1000)
    if (!checkLimit.ok) {
      return NextResponse.json({ error: 'Too many alias checks. Please slow down.' }, { status: 429 })
    }
    const validation = validateLocalPart(normalized)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }
    // Check active inbox conflict
    const activeConflict = await db.inbox.findFirst({
      where: { localPart: normalized, domainId: domainRow.id, status: 'active' },
    })
    if (activeConflict && activeConflict.expiresAt > new Date()) {
      return NextResponse.json({ error: 'This address is already taken' }, { status: 409 })
    }
    // Check anti-squatting cooldown ledger
    const aliasLedger = await db.customAlias.findUnique({
      where: { localPart_domainId: { localPart: normalized, domainId: domainRow.id } },
    })
    if (aliasLedger?.cooldownUntil && aliasLedger.cooldownUntil > new Date()) {
      // L4 exception: the SAME session that previously owned this alias can reclaim it
      // (prevents a user from being locked out of their own recently-expired alias)
      const sessionHash = hashToken(sessionId)
      if (aliasLedger.lastUsedBySessionHash !== sessionHash) {
        return NextResponse.json(
          { error: `This custom alias is in a cooldown period until ${aliasLedger.cooldownUntil.toLocaleTimeString()}. Try again later.` },
          { status: 409 }
        )
      }
      // Same session — allow reclaim, clear the cooldown
      await db.customAlias.update({
        where: { localPart_domainId: { localPart: normalized, domainId: domainRow.id } },
        data: { cooldownUntil: null },
      })
    }
    localPart = normalized
    isCustom = true
  } else {
    // Generate unique random local-part (10 attempts)
    let attempts = 0
    let candidate = ''
    while (attempts < 10) {
      candidate = generateLocalPart()
      const exists = await db.inbox.findFirst({
        where: { localPart: candidate, domainId: domainRow.id, status: 'active' },
      })
      if (!exists) { localPart = candidate; break }
      attempts++
    }
    if (!localPart!) {
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

  const email = buildEmailAddress(localPart, domainRow.domain)
  const expiresAt = new Date(Date.now() + lifetime * 60 * 1000)

  // Clean up any expired prior inbox for same local-part+domain (so the unique constraint holds)
  await db.inbox.deleteMany({
    where: { localPart, domainId: domainRow.id, status: { in: ['expired', 'deleted'] } },
  })

  const inbox = await db.inbox.create({
    data: {
      email,
      localPart,
      domainId: domainRow.id,
      isCustomAlias: isCustom,
      status: 'active',
      category,
      burnOnRead: !!burnOnRead,
      expiresAt,
      sessionId,
      maxMessages: QUOTAS.MAX_MESSAGES_PER_INBOX,
    },
    include: { domain: true, _count: { select: { messages: true } } },
  })

  // For custom aliases: record which session claimed it, so L4 same-session
  // reclaim exception can work when the alias later expires and enters cooldown.
  if (isCustom) {
    await db.customAlias.upsert({
      where: { localPart_domainId: { localPart, domainId: domainRow.id } },
      update: { lastUsedBySessionHash: hashToken(sessionId), cooldownUntil: null },
      create: {
        localPart,
        domainId: domainRow.id,
        lastUsedBySessionHash: hashToken(sessionId),
      },
    })
  }

  await auditLog({ sessionId, action: 'inbox.create', targetType: 'inbox', targetId: inbox.id, metadata: { email }, ip })

  const res = NextResponse.json({ inbox }, { status: 201 })
  if (setCookie) res.headers.set('set-cookie', setCookie)
  return res
}
