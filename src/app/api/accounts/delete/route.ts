// POST /api/accounts/delete — L5: Account deletion with grace period
// Per GAP-ANALYSIS-V2.md L5: cancel sends, disable vacation, revoke sessions, grace period
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId, clearAccountCookie } from '@/lib/auth-utils'

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { confirmPhrase } = body || {}

  // Require typed confirmation
  if (confirmPhrase !== 'DELETE') {
    return NextResponse.json({ error: 'Please type DELETE to confirm' }, { status: 400 })
  }

  // L5: Cancel all pending scheduled sends (none in temp mode, but for accounts:)
  // Disable Vacation Responder immediately
  await db.vacationResponder.updateMany({
    where: { accountId },
    data: { enabled: false },
  })

  // Revoke all login sessions
  await db.loginSession.updateMany({
    where: { accountId, revoked: false },
    data: { revoked: true },
  })

  // Revoke all app passwords
  await db.appPassword.updateMany({
    where: { accountId, revoked: false },
    data: { revoked: true },
  })

  // Enter grace-deletion window (14 days)
  const graceEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  await db.account.update({
    where: { id: accountId },
    data: {
      status: 'grace_deletion',
      deletionScheduledAt: graceEnd,
    },
  })

  // Audit log
  await db.auditLog.create({
    data: {
      accountId,
      action: 'account.deletion_requested',
      targetType: 'account',
      targetId: accountId,
    },
  })

  const res = NextResponse.json({
    ok: true,
    message: 'Your account will be permanently deleted in 14 days. Sign in before then to cancel.',
    deletionDate: graceEnd,
  })
  res.headers.set('set-cookie', clearAccountCookie())
  return res
}
