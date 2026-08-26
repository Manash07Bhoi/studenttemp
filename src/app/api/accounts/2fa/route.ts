// DELETE /api/accounts/2fa — Disable 2FA (requires password confirmation)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function DELETE(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { password } = body || {}
  if (!password) return NextResponse.json({ error: 'Password required to disable 2FA' }, { status: 400 })

  const account = await db.account.findUnique({ where: { id: accountId }, select: { passwordHash: true, totpEnabled: true } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (!account.totpEnabled) return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })

  const { verifyPassword } = await import('@/lib/auth-utils')
  const valid = await verifyPassword(String(password), account.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

  await db.account.update({
    where: { id: accountId },
    data: { totpEnabled: false, totpSecretEncrypted: null },
  })
  await db.backupCode.deleteMany({ where: { accountId } })

  await db.auditLog.create({
    data: { accountId, action: 'account.2fa.disabled', targetType: 'account', targetId: accountId },
  })

  return NextResponse.json({ ok: true })
}
