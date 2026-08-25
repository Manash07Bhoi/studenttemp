// POST /api/auth/signup — Create a new account (Account Mode)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createAccountSession, setAccountCookie, getExpiryForPlan } from '@/lib/auth-utils'
import { getClientIp, rateLimit, hashToken } from '@/lib/mail-utils'
import { validateLocalPart } from '@/lib/mail-utils'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const limit = rateLimit(`signup:${ip}`, 3, 60 * 60 * 1000) // 3/hour
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many sign-up attempts. Please try later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { fullName, username, domain, password, recoveryEmail, recoveryPhone } = body || {}

  // Validation
  if (!fullName || !username || !domain || !password) {
    return NextResponse.json({ error: 'All required fields must be provided' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    return NextResponse.json({ error: 'Password must contain uppercase, lowercase, and a number' }, { status: 400 })
  }

  const localPart = String(username).toLowerCase().trim()
  const validation = validateLocalPart(localPart)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const domainRow = await db.domain.findFirst({ where: { domain, active: true } })
  if (!domainRow) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  const email = `${localPart}@${domain}`
  // Check if email already exists
  const existing = await db.account.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'This email address is already taken' }, { status: 409 })
  }

  // Check if there's an active temp inbox using this address
  const activeInbox = await db.inbox.findFirst({
    where: { email, status: 'active' },
  })
  if (activeInbox && activeInbox.expiresAt > new Date()) {
    return NextResponse.json({ error: 'This address is currently in use by a temporary inbox. Try again after it expires.' }, { status: 409 })
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create account
  const account = await db.account.create({
    data: {
      email,
      passwordHash,
      displayName: fullName,
      recoveryEmail: recoveryEmail || null,
      recoveryPhone: recoveryPhone || null,
    },
  })

  // Create the permanent mailbox inbox
  const expiresAt = getExpiryForPlan('permanent')
  await db.inbox.create({
    data: {
      email,
      localPart,
      domainId: domainRow.id,
      isCustomAlias: true,
      status: 'active',
      isPermanent: true,
      planDuration: 'permanent',
      expiresAt,
      accountId: account.id,
      maxMessages: 10000, // higher limit for accounts
    },
  })

  // Create system labels
  const systemLabels = [
    { name: 'Inbox', color: '#10b981', isSystemLabel: true },
    { name: 'Starred', color: '#f59e0b', isSystemLabel: true },
    { name: 'Sent', color: '#06b6d4', isSystemLabel: true },
    { name: 'Drafts', color: '#6b7280', isSystemLabel: true },
    { name: 'Spam', color: '#ef4444', isSystemLabel: true, retentionDays: 30 },
    { name: 'Trash', color: '#6b7280', isSystemLabel: true, retentionDays: 30 },
    { name: 'All Mail', color: '#8b5cf6', isSystemLabel: true },
  ]
  for (const label of systemLabels) {
    await db.label.create({
      data: { ...label, accountId: account.id },
    })
  }

  // Create vacation responder (disabled by default)
  await db.vacationResponder.create({
    data: { accountId: account.id },
  })

  // Create session
  const ipHash = hashToken(ip)
  const sessionToken = await createAccountSession(account.id, ipHash, req.headers.get('user-agent') || '')

  // Audit log
  await db.auditLog.create({
    data: {
      accountId: account.id,
      action: 'account.signup',
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
    },
  }, { status: 201 })
  res.headers.set('set-cookie', setAccountCookie(sessionToken, req))
  return res
}
