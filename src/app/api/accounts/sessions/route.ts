// GET /api/accounts/sessions — List active sessions
// DELETE /api/accounts/sessions — Revoke a session
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const sessions = await db.loginSession.findMany({
    where: { accountId, revoked: false },
    orderBy: { lastSeenAt: 'desc' },
  })
  return NextResponse.json({ sessions })
}

export async function DELETE(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { sessionId } = body || {}
  if (sessionId) {
    await db.loginSession.updateMany({
      where: { id: sessionId, accountId },
      data: { revoked: true },
    })
  } else {
    // Revoke all except current
    await db.loginSession.updateMany({
      where: { accountId, revoked: false },
      data: { revoked: true },
    })
  }
  return NextResponse.json({ ok: true })
}
