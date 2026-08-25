// POST /api/accounts/2fa/verify — Verify a TOTP code and enable 2FA
// On success, generates 10 backup codes and enables 2FA
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId, verifyTOTP } from '@/lib/auth-utils'
import crypto from 'crypto'

function base32Decode(encoded: string): Buffer | null {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
  if (!cleaned) return null
  const bits: string[] = []
  for (const c of cleaned) {
    const idx = alphabet.indexOf(c)
    if (idx === -1) return null
    bits.push(idx.toString(2).padStart(5, '0'))
  }
  const allBits = bits.join('')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= allBits.length; i += 8) {
    bytes.push(parseInt(allBits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

export async function POST(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code } = body || {}
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 })
  }

  const account = await db.account.findUnique({ where: { id: accountId }, select: { totpSecretEncrypted: true, totpEnabled: true, email: true } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.totpEnabled) return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  if (!account.totpSecretEncrypted) return NextResponse.json({ error: 'No TOTP secret found. Run setup first.' }, { status: 400 })

  // Decrypt the stored secret back to Base32 for verification
  const encryptionKey = process.env.TOTP_ENCRYPTION_KEY || 'studenttemp-totp-key-sandbox-only'
  const encryptedBytes = Buffer.from(account.totpSecretEncrypted, 'hex')
  const decryptedBytes = Buffer.from(encryptedBytes.map((b, i) => b ^ encryptionKey.charCodeAt(i % encryptionKey.length)))
  const secret = (() => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = 0, value = 0, output = ''
    for (const byte of decryptedBytes) {
      value = (value << 8) | byte
      bits += 8
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]
    return output
  })()

  // Verify the code using the real RFC 6238 implementation
  if (!verifyTOTP(String(code), secret)) {
    return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 })
  }

  // Generate 10 backup codes (8-character, alphanumeric)
  const backupCodes: string[] = []
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.randomBytes(6)
    const code = bytes.toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 8).toUpperCase()
    backupCodes.push(code)
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await db.backupCode.create({
      data: { accountId, codeHash },
    })
  }

  // Enable 2FA
  await db.account.update({
    where: { id: accountId },
    data: { totpEnabled: true },
  })

  // Audit log
  await db.auditLog.create({
    data: { accountId, action: 'account.2fa.enabled', targetType: 'account', targetId: accountId },
  })

  return NextResponse.json({
    ok: true,
    backupCodes,
    message: '2FA enabled. Save these backup codes — they can only be viewed once.',
  })
}
