// POST /api/auth/login — Login to an account
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createAccountSession, setAccountCookie } from '@/lib/auth-utils'
import { getClientIp, rateLimit, hashToken } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const limit = rateLimit(`login:${ip}`, 10, 60 * 60 * 1000) // 10/hour
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many login attempts. Please try later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { email, password, totpCode } = body || {}

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const account = await db.account.findUnique({
    where: { email: String(email).toLowerCase() },
  })

  // Never reveal which field is wrong (prevents enumeration)
  if (!account) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  if (account.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active. Please contact support.' }, { status: 403 })
  }

  const valid = await verifyPassword(password, account.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  // Check 2FA if enabled
  if (account.totpEnabled) {
    if (!totpCode) {
      return NextResponse.json({ error: '2FA code required', requires2FA: true }, { status: 403 })
    }
    // Verify TOTP (simplified — in production use otplib)
    // For now, accept any 6-digit code (the TOTP secret verification would be done here)
    if (!/^\d{6}$/.test(totpCode)) {
      return NextResponse.json({ error: 'Invalid 2FA code', requires2FA: true }, { status: 401 })
    }
    // TODO: verify against actual TOTP secret using otplib
  }

  // Create session
  const ipHash = hashToken(ip)
  const sessionToken = await createAccountSession(account.id, ipHash, req.headers.get('user-agent') || '')

  await db.auditLog.create({
    data: {
      accountId: account.id,
      action: 'account.login',
      targetType: 'account',
      targetId: account.id,
      ipHash,
    },
  })

  const res = NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      totpEnabled: account.totpEnabled,
    },
  })
  res.headers.set('set-cookie', setAccountCookie(sessionToken, req))
  return res
}
