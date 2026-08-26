// POST /api/accounts/2fa/backup-codes — Regenerate backup codes
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'
import crypto from 'crypto'

export async function POST() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const account = await db.account.findUnique({ where: { id: accountId }, select: { totpEnabled: true } })
  if (!account?.totpEnabled) {
    return NextResponse.json({ error: '2FA must be enabled to regenerate backup codes' }, { status: 400 })
  }

  // Delete old backup codes
  await db.backupCode.deleteMany({ where: { accountId } })

  // Generate 10 new backup codes
  const backupCodes: string[] = []
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.randomBytes(6)
    const code = bytes.toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 8).toUpperCase()
    backupCodes.push(code)
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await db.backupCode.create({ data: { accountId, codeHash } })
  }

  return NextResponse.json({
    ok: true,
    backupCodes,
    message: 'New backup codes generated. Previous codes are now invalid.',
  })
}
