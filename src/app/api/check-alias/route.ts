// POST /api/check-alias — check if a custom local-part is available (rate-limited)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateLocalPart, getClientIp, rateLimit, getSessionId, hashToken } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  // 20/min/IP before Turnstile escalation (per PRD quota table)
  const limit = rateLimit(`check-alias:${ip}`, 20, 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { available: false, reason: 'Too many availability checks. Please slow down.' },
      { status: 429 }
    )
  }
  const body = await req.json().catch(() => ({}))
  const { localPart, domain: domainName } = body || {}
  if (!localPart || !domainName) {
    return NextResponse.json({ available: false, reason: 'Missing input' }, { status: 400 })
  }
  const domainRow = await db.domain.findFirst({ where: { domain: domainName, active: true } })
  if (!domainRow) {
    return NextResponse.json({ available: false, reason: 'Invalid domain' }, { status: 400 })
  }
  const normalized = String(localPart).toLowerCase().trim()
  const validation = validateLocalPart(normalized)
  if (!validation.ok) {
    return NextResponse.json({ available: false, reason: validation.reason })
  }
  const activeConflict = await db.inbox.findFirst({
    where: { localPart: normalized, domainId: domainRow.id, status: 'active' },
  })
  if (activeConflict && activeConflict.expiresAt > new Date()) {
    return NextResponse.json({ available: false, reason: 'Already taken' })
  }
  const ledger = await db.customAlias.findUnique({
    where: { localPart_domainId: { localPart: normalized, domainId: domainRow.id } },
  })
  if (ledger?.cooldownUntil && ledger.cooldownUntil > new Date()) {
    // GAP L4: Same session can reclaim their own expired alias without cooldown
    const currentSessionId = await getSessionId(req)
    if (currentSessionId && ledger.lastUsedBySessionHash === hashToken(currentSessionId)) {
      // Same session — allow immediate reclaim, skip cooldown
    } else {
      return NextResponse.json({
        available: false,
        reason: `In cooldown until ${ledger.cooldownUntil.toLocaleTimeString()}`,
      })
    }
  }
  return NextResponse.json({ available: true, email: `${normalized}@${domainRow.domain}` })
}
