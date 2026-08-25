// GET /api/accounts/aliases — List aliases
// POST /api/accounts/aliases — Create an alias
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'
import { validateLocalPart, getClientIp, rateLimit } from '@/lib/mail-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const aliases = await db.accountAlias.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ aliases })
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const ip = getClientIp(req)
  const limit = rateLimit(`alias:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Rate limit' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const { aliasAddress, signature } = body || {}
  if (!aliasAddress) return NextResponse.json({ error: 'Alias address required' }, { status: 400 })

  const localPart = String(aliasAddress).split('@')[0]?.toLowerCase() || ''
  const validation = validateLocalPart(localPart)
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 })

  const existing = await db.accountAlias.findUnique({ where: { aliasAddress: String(aliasAddress).toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Alias already exists' }, { status: 409 })

  const alias = await db.accountAlias.create({
    data: {
      accountId,
      aliasAddress: String(aliasAddress).toLowerCase(),
      signature: signature || null,
    },
  })
  return NextResponse.json({ alias }, { status: 201 })
}
