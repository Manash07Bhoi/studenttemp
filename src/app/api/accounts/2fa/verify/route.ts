// POST /api/accounts/2fa/verify — Verify a TOTP code and enable 2FA
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId, verifyTOTP } from '@/lib/auth-utils'
import crypto from 'crypto'

// AES-256-GCM decryption
function decryptSecret(encryptedStr: string): Buffer {
  const keyHex = process.env.TOTP_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be a 64-char hex string')
  }
  const key = Buffer.from(keyHex, 'hex')
  const parts = encryptedStr.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format')
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = Buffer.from(parts[2], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0, output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }
  return output
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code } = body || {}
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 })
  }

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { totpSecretEncrypted: true, totpEnabled: true, email: true },
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.totpEnabled) return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  if (!account.totpSecretEncrypted) return NextResponse.json({ error: 'No TOTP secret found. Run setup first.' }, { status: 400 })

  try {
    const decryptedBytes = decryptSecret(account.totpSecretEncrypted)
    const secret = base32Encode(decryptedBytes)

    if (!verifyTOTP(String(code), secret)) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 })
    }
  } catch (e) {
    console.error('[2fa] decrypt error:', e)
    return NextResponse.json({ error: 'Failed to verify. Please re-setup 2FA.' }, { status: 500 })
  }

  // Generate 10 backup codes
  const backupCodes: string[] = []
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.randomBytes(6)
    const code = bytes.toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 8).toUpperCase()
    backupCodes.push(code)
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await db.backupCode.create({ data: { accountId, codeHash } })
  }

  await db.account.update({
    where: { id: accountId },
    data: { totpEnabled: true },
  })

  await db.auditLog.create({
    data: { accountId, action: 'account.2fa.enabled', targetType: 'account', targetId: accountId },
  })

  return NextResponse.json({
    ok: true,
    backupCodes,
    message: '2FA enabled. Save these backup codes — they can only be viewed once.',
  })
}
