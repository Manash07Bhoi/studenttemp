// POST /api/check-alias — check if a custom local-part is available
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateLocalPart, DOMAINS } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { localPart, domain } = body || {}
  if (!localPart || !domain) {
    return NextResponse.json({ available: false, reason: 'Missing input' }, { status: 400 })
  }
  const validDomain = DOMAINS.find(d => d.domain === domain)
  if (!validDomain) {
    return NextResponse.json({ available: false, reason: 'Invalid domain' }, { status: 400 })
  }
  const normalized = String(localPart).toLowerCase().trim()
  const validation = validateLocalPart(normalized)
  if (!validation.ok) {
    return NextResponse.json({ available: false, reason: validation.reason })
  }
  const existing = await db.inbox.findFirst({
    where: { localPart: normalized, domain: validDomain.domain },
  })
  if (existing && existing.expiresAt > new Date()) {
    return NextResponse.json({ available: false, reason: 'Already taken' })
  }
  if (existing && existing.expiresAt < new Date()) {
    const cooldownEnd = new Date(existing.expiresAt.getTime() + 5 * 60 * 1000)
    if (cooldownEnd > new Date()) {
      return NextResponse.json({ available: false, reason: 'In cooldown after recent expiry' })
    }
  }
  return NextResponse.json({ available: true, email: `${normalized}@${validDomain.domain}` })
}
