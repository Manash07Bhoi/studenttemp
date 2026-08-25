// StudentTemp — shared server-side utilities (REAL, no mocks)

import { db } from '@/lib/db'
import crypto from 'crypto'
import { cookies } from 'next/headers'

// ---------- Domains ----------
// These are the only domains this service will ever accept mail for.
// Loaded from the real Domains table; this fallback is used only for SSR before DB read.
export const FALLBACK_DOMAINS = [
  { domain: 'studentbox.in', label: 'StudentBox', badge: 'Most Popular', popular: true, pack: 'indian_student', country: 'india', category: 'student' },
  { domain: 'campusmail.in', label: 'CampusMail', badge: '', popular: false, pack: 'indian_student', country: 'india', category: 'student' },
  { domain: 'examprep.in', label: 'ExamPrep', badge: '', popular: false, pack: 'indian_student', country: 'india', category: 'student' },
  { domain: 'devtest.in', label: 'DevTest', badge: '', popular: false, pack: 'standard', country: 'india', category: 'developer' },
  { domain: 'quickmail.in', label: 'QuickMail', badge: '', popular: false, pack: 'standard', country: 'india', category: 'general' },
] as const

export async function getDomains() {
  const rows = await db.domain.findMany({ where: { active: true }, orderBy: { reputationScore: 'desc' } })
  if (rows.length === 0) return FALLBACK_DOMAINS
  return rows.map((d) => {
    const label = d.domain.split('.')[0].charAt(0).toUpperCase() + d.domain.split('.')[0].slice(1)
    let badge = ''
    if (d.domain === 'studentbox.in') badge = 'Most Popular'
    else if (d.pack === 'academic') badge = '🎓 Academic'
    else if (d.pack === 'indian_student') badge = 'India'
    else if (d.pack === 'international') badge = 'Global'
    else if (d.pack === 'privacy') badge = 'Privacy'
    return {
      domain: d.domain,
      label,
      badge,
      popular: d.domain === 'studentbox.in',
      pack: d.pack,
      country: d.country,
      category: d.category,
    }
  })
}

export async function getDomainRow(domain: string) {
  return db.domain.findFirst({ where: { domain, active: true } })
}

// ---------- Inbox lifetime options ----------
export const INBOX_LIFETIME_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes', default: true },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '24 hours' },
] as const

export const CATEGORY_PRESETS = [
  { value: 'general', label: 'General', desc: 'No specific purpose' },
  { value: 'otp', label: 'OTP / Verification', desc: 'Quick verification codes' },
  { value: 'registration', label: 'Registration', desc: 'Sign-ups & confirmations' },
  { value: 'newsletter', label: 'Newsletter', desc: 'Subscribe & read' },
  { value: 'social', label: 'Social', desc: 'Social media sign-up' },
  { value: 'shopping', label: 'Shopping', desc: 'Online orders' },
  { value: 'security', label: 'Security', desc: 'Account security alerts' },
] as const

// ---------- Reserved & blocked local-parts ----------
export const RESERVED_LOCAL_PARTS = new Set([
  'admin', 'administrator', 'support', 'postmaster', 'abuse', 'security',
  'noreply', 'no-reply', 'webmaster', 'info', 'contact', 'help', 'mail',
  'root', 'system', 'test', 'demo', 'team', 'office', 'sales', 'billing',
  'paypal', 'bank', 'verify', 'official', 'government', 'gov', 'mailer-daemon',
  'postoffice', 'hostmaster', 'usenet', 'news', 'uucp', 'ftp', 'anoncvs',
])

export const BLOCKED_PATTERNS = [
  /paypal/i, /bank[-_]?verify/i, /official[-_]?support/i, /gov[-_]?verify/i,
  /admin[-_]?support/i, /security[-_]?team/i, /noreply[-_]?official/i,
  /\.edu\.in$/i, /\.ac\.in$/i, /\.edu$/i,
]

// ---------- CSPRNG local-part generation (10 chars from unambiguous alphabet) ----------
const LOCAL_PART_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/O/1/l
const LOCAL_PART_PREFIX = 'student-'

export function generateLocalPart(): string {
  const bytes = crypto.randomBytes(10)
  let out = LOCAL_PART_PREFIX
  for (let i = 0; i < 10; i++) {
    out += LOCAL_PART_ALPHABET[bytes[i] % LOCAL_PART_ALPHABET.length]
  }
  return out
}

// ---------- Local-part validation ----------
export function validateLocalPart(local: string): { ok: boolean; reason?: string } {
  if (!local) return { ok: false, reason: 'Local part is required' }
  if (local.length < 3) return { ok: false, reason: 'Must be at least 3 characters' }
  if (local.length > 30) return { ok: false, reason: 'Must be 30 characters or fewer' }
  if (!/^[a-z0-9._-]+$/i.test(local)) return { ok: false, reason: 'Only letters, numbers, . _ - allowed' }
  if (/^[._-]|[._-]$/.test(local)) return { ok: false, reason: 'Cannot start or end with a symbol' }
  if (/[._-]{2,}/.test(local)) return { ok: false, reason: 'Consecutive symbols not allowed' }
  if (RESERVED_LOCAL_PARTS.has(local.toLowerCase())) return { ok: false, reason: 'This name is reserved' }
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(local)) return { ok: false, reason: 'This pattern is not allowed' }
  }
  return { ok: true }
}

// ---------- Session management ----------
// Session token is shown to user once as a recovery code (ST-XXXX-XXXX format).
// Server stores only SHA-256 hash. Raw token never persisted.
export const SESSION_COOKIE = 'st_session'
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function generateSessionToken(): string {
  // ST-XXXX-XXXX format (human-friendly recovery code)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 confusion
  const bytes = crypto.randomBytes(8)
  let code = 'ST-'
  for (let i = 0; i < 4; i++) code += alphabet[bytes[i] % alphabet.length]
  code += '-'
  for (let i = 4; i < 8; i++) code += alphabet[bytes[i] % alphabet.length]
  return code
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function getSessionId(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
  if (!match) return null
  // Resolve the raw token -> session ID via hash lookup
  const tokenHash = hashToken(match[1])
  const session = await db.session.findUnique({ where: { tokenHash }, select: { id: true, expiresAt: true } })
  if (!session || session.expiresAt < new Date()) return null
  // Refresh lastSeen
  await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
  return session.id
}

export async function getOrCreateSession(req: Request): Promise<{ sessionId: string; token: string; setCookie?: string }> {
  const existing = await getSessionId(req)
  if (existing) {
    // We don't have the raw token anymore (only hash); return empty token to signal "no new cookie"
    return { sessionId: existing, token: '' }
  }
  // Create new session
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const session = await db.session.create({
    data: {
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_COOKIE_MAX_AGE * 1000),
      maxInboxes: 5,
      locale: 'en',
    },
  })
  const setCookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_COOKIE_MAX_AGE}`
  return { sessionId: session.id, token, setCookie }
}

export async function getSessionIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = await db.session.findUnique({ where: { tokenHash }, select: { id: true, expiresAt: true } })
  if (!session || session.expiresAt < new Date()) return null
  return session.id
}

// ---------- Quotas ----------
export const QUOTAS = {
  MAX_ACTIVE_INBOXES_PER_SESSION: 5,
  MAX_MESSAGES_PER_INBOX: 100,
  DEFAULT_LIFETIME_MIN: 10,
  MAX_MESSAGE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_ATTACHMENT_SIZE: 5 * 1024 * 1024, // 5 MB
  MAX_ATTACHMENT_TOTAL: 15 * 1024 * 1024, // 15 MB
} as const

export async function checkInboxQuota(sessionId: string): Promise<{ ok: boolean; count: number }> {
  const count = await db.inbox.count({
    where: { sessionId, status: 'active', expiresAt: { gt: new Date() } },
  })
  return { ok: count < QUOTAS.MAX_ACTIVE_INBOXES_PER_SESSION, count }
}

export function buildEmailAddress(local: string, domain: string): string {
  return `${local}@${domain}`
}

// ---------- Rate limiting (in-memory token bucket) ----------
interface Bucket { count: number; resetAt: number; limit: number; windowMs: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs, limit, windowMs }
    buckets.set(key, b)
  }
  if (b.count >= b.limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt }
  }
  b.count++
  return { ok: true, remaining: b.limit - b.count, resetAt: b.resetAt }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri
  return '127.0.0.1'
}

// ---------- Audit logging ----------
export async function auditLog(opts: { sessionId?: string; action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string }) {
  await db.auditLog.create({
    data: {
      sessionId: opts.sessionId || null,
      action: opts.action,
      targetType: opts.targetType || null,
      targetId: opts.targetId || null,
      metadata: JSON.stringify(opts.metadata || {}),
      ipHash: opts.ip ? hashToken(opts.ip) : null,
    },
  })
}
