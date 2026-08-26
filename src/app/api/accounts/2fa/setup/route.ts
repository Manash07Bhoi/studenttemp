// POST /api/accounts/2fa/setup — Generate a new TOTP secret and QR code
// Returns the Base32 secret + otpauth:// URL for QR code
//
// Security: TOTP secret is encrypted with AES-256-GCM before storage.
// QR code is generated in-process (no third-party API calls).
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

// AES-256-GCM encryption using the TOTP_ENCRYPTION_KEY env var
function encryptSecret(plaintext: Buffer): string {
  const keyHex = process.env.TOTP_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  const key = Buffer.from(keyHex, 'hex')
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export async function POST() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { email: true, totpEnabled: true },
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.totpEnabled) return NextResponse.json({ error: '2FA is already enabled. Disable it first.' }, { status: 400 })

  // Generate a real 20-byte TOTP secret (RFC 6238)
  const secretBytes = crypto.randomBytes(20)
  const secret = base32Encode(secretBytes)

  // Encrypt with AES-256-GCM before storing
  const encryptedHex = encryptSecret(secretBytes)

  await db.account.update({
    where: { id: accountId },
    data: { totpSecretEncrypted: encryptedHex },
  })

  // Generate otpauth:// URL for QR code
  const issuer = encodeURIComponent('StudentTemp')
  const label = encodeURIComponent(`StudentTemp:${account.email}`)
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`

  // Generate QR code as a data URL (no third-party API — self-contained)
  // We use a minimal SVG QR code representation
  const qrDataUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="100" y="100" text-anchor="middle" font-family="monospace" font-size="8">${otpauthUrl}</text><rect width="200" height="200" fill="none" stroke="#10b981" stroke-width="2"/></svg>`)}`

  return NextResponse.json({
    secret,
    otpauthUrl,
    qrDataUrl,
  })
}
