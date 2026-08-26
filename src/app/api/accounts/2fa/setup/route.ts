// POST /api/accounts/2fa/setup — Generate a new TOTP secret and QR code
// Returns the Base32 secret + otpauth:// URL for QR code generation
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'
import crypto from 'crypto'

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

export async function POST() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const account = await db.account.findUnique({ where: { id: accountId }, select: { email: true, totpEnabled: true, totpSecretEncrypted: true } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.totpEnabled) return NextResponse.json({ error: '2FA is already enabled. Disable it first.' }, { status: 400 })

  // Generate a real 20-byte TOTP secret (RFC 6238)
  const secretBytes = crypto.randomBytes(20)
  const secret = base32Encode(secretBytes)

  // Encrypt the secret before storing (AES-256-GCM with a derived key)
  // For sandbox: we use a simple XOR obfuscation (NOT for production — see OPEN-QUESTIONS.md)
  // In production: use AES-256-GCM with a KMS-managed key.
  const encryptionKey = process.env.TOTP_ENCRYPTION_KEY || 'studenttemp-totp-key-sandbox-only'
  const encrypted = secretBytes.map((b, i) => b ^ encryptionKey.charCodeAt(i % encryptionKey.length))
  const encryptedHex = Buffer.from(encrypted).toString('hex')

  // Store the encrypted secret (not yet enabled — user must verify first)
  await db.account.update({
    where: { id: accountId },
    data: { totpSecretEncrypted: encryptedHex },
  })

  // Generate otpauth:// URL for QR code
  const issuer = encodeURIComponent('StudentTemp')
  const label = encodeURIComponent(`${issuer}:${account.email}`)
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`

  return NextResponse.json({
    secret,
    otpauthUrl,
    qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
  })
}
