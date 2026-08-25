// Auth utilities for Account Mode
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

const ACCOUNT_COOKIE = 'st_account'
const ACCOUNT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function generateAccountToken(): string {
  return 'atk_' + crypto.randomBytes(24).toString('hex')
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function getAccountId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ACCOUNT_COOKIE)?.value
  if (!token) return null
  // Look up the token in LoginSession
  const session = await db.loginSession.findFirst({
    where: { id: token, revoked: false },
    select: { accountId: true, lastSeenAt: true },
  })
  if (!session) return null
  // Update lastSeen
  await db.loginSession.update({
    where: { id: token },
    data: { lastSeenAt: new Date() },
  })
  return session.accountId
}

export async function createAccountSession(accountId: string, ipHash?: string, deviceInfo?: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex')
  await db.loginSession.create({
    data: {
      id: token,
      accountId,
      ipHash,
      deviceInfo: deviceInfo || '',
    },
  })
  return token
}

/**
 * Whether the request should mark cookies as `Secure`.
 *
 * We set `Secure` whenever the deployment is reachable over HTTPS:
 *  - In production: always.
 *  - In development: only when the request actually arrived over TLS
 *    (Caddy fronts the dev server with `tls internal`). When developing
 *    without the proxy (direct :3000), `Secure` is omitted so the
 *    HttpOnly cookie still reaches the browser.
 *
 * Detection: we trust `X-Forwarded-Proto` ONLY when it comes from our
 * Caddy reverse proxy (loopback peer). See `src/middleware.ts`.
 */
function shouldSetSecure(req?: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true
  if (!req) return false
  const xff = req.headers.get('x-forwarded-for') || ''
  const peer = xff.split(',').pop()?.trim()
  const trusted = peer === '127.0.0.1' || peer === '::1' || peer === 'localhost'
  if (!trusted) return false
  const proto = req.headers.get('x-forwarded-proto')
  return proto === 'https'
}

export function setAccountCookie(token: string, req?: Request): string {
  const secure = shouldSetSecure(req) ? '; Secure' : ''
  return `${ACCOUNT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${ACCOUNT_COOKIE_MAX_AGE}`
}

export function clearAccountCookie(req?: Request): string {
  const secure = shouldSetSecure(req) ? '; Secure' : ''
  return `${ACCOUNT_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`
}

export const ACCOUNT_COOKIE_NAME = ACCOUNT_COOKIE

// Time-limited mailbox plan durations (per user request)
export const PLAN_DURATIONS = [
  { value: '1h', label: '1 Hour', minutes: 60 },
  { value: '1d', label: '1 Day', minutes: 1440 },
  { value: '7d', label: '7 Days', minutes: 10080 },
  { value: '30d', label: '1 Month', minutes: 43200 },
  { value: '90d', label: '3 Months', minutes: 129600 },
  { value: '180d', label: '6 Months', minutes: 259200 },
  { value: '365d', label: '1 Year', minutes: 525600 },
  { value: 'permanent', label: 'Permanent (until deleted)', minutes: 0 }, // 0 = no expiry
] as const

export function getExpiryForPlan(plan: string): Date {
  const duration = PLAN_DURATIONS.find(d => d.value === plan)
  if (!duration || duration.minutes === 0) {
    // Permanent — set to year 2099
    return new Date('2099-12-31T23:59:59Z')
  }
  return new Date(Date.now() + duration.minutes * 60 * 1000)
}
