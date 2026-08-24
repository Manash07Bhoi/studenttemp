// StudentTemp — shared server-side utilities

import { db } from '@/lib/db'
import crypto from 'crypto'

// Available operator-owned domains (clearly NOT real .edu/.ac.in)
export const DOMAINS = [
  { domain: 'studentbox.in', label: 'StudentBox', badge: 'Most Popular', popular: true },
  { domain: 'campusmail.in', label: 'CampusMail', badge: '', popular: false },
  { domain: 'examprep.in', label: 'ExamPrep', badge: 'New', popular: false },
  { domain: 'devtest.in', label: 'DevTest', badge: '', popular: false },
  { domain: 'quickmail.in', label: 'QuickMail', badge: '', popular: false },
] as const

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

// Reserved local-parts that cannot be claimed as custom aliases
export const RESERVED_LOCAL_PARTS = [
  'admin', 'administrator', 'support', 'postmaster', 'abuse', 'security',
  'noreply', 'no-reply', 'webmaster', 'info', 'contact', 'help', 'mail',
  'root', 'system', 'test', 'demo', 'team', 'office', 'sales', 'billing',
  'paypal', 'bank', 'verify', 'official', 'government', 'gov',
]

// Profanity / impersonation patterns (simple blocklist)
export const BLOCKED_PATTERNS = [
  /paypal/i, /bank[-_]?verify/i, /official[-_]?support/i, /gov[-_]?verify/i,
  /admin[-_]?support/i, /security[-_]?team/i, /noreply[-_]?official/i,
]

// CSPRNG local-part: 10 chars from unambiguous alphabet (no 0/O/1/l)
const LOCAL_PART_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const LOCAL_PART_PREFIX = 'student-'

export function generateLocalPart(): string {
  const bytes = crypto.randomBytes(10)
  let out = LOCAL_PART_PREFIX
  for (let i = 0; i < 10; i++) {
    out += LOCAL_PART_ALPHABET[bytes[i] % LOCAL_PART_ALPHABET.length]
  }
  return out
}

// Validate a custom local-part against all rules
export function validateLocalPart(local: string): { ok: boolean; reason?: string } {
  if (!local) return { ok: false, reason: 'Local part is required' }
  if (local.length < 3) return { ok: false, reason: 'Must be at least 3 characters' }
  if (local.length > 30) return { ok: false, reason: 'Must be 30 characters or fewer' }
  if (!/^[a-z0-9._-]+$/i.test(local)) return { ok: false, reason: 'Only letters, numbers, . _ - allowed' }
  if (/^[._-]|[._-]$/.test(local)) return { ok: false, reason: 'Cannot start or end with a symbol' }
  if (/[._-]{2,}/.test(local)) return { ok: false, reason: 'Consecutive symbols not allowed' }
  if (RESERVED_LOCAL_PARTS.includes(local.toLowerCase())) return { ok: false, reason: 'This name is reserved' }
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(local)) return { ok: false, reason: 'This pattern is not allowed' }
  }
  return { ok: true }
}

// Session management — anonymous session stored in a cookie
export function getSessionId(req: Request): string {
  // Read cookie header
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/(?:^|;\s*)st_session=([^;]+)/)
  return match ? match[1] : ''
}

export function generateSessionId(): string {
  return 'sess_' + crypto.randomBytes(16).toString('hex')
}

export const SESSION_COOKIE = 'st_session'
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function setSessionCookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_COOKIE_MAX_AGE}`
}

// Quotas
export const QUOTAS = {
  MAX_ACTIVE_INBOXES_PER_SESSION: 5,
  MAX_MESSAGES_PER_INBOX: 100,
  DEFAULT_LIFETIME_MIN: 10,
} as const

export async function getSessionOrCreate(req: Request): Promise<{ sessionId: string; setCookie?: string }> {
  let sessionId = getSessionId(req)
  let setCookie: string | undefined
  if (!sessionId) {
    sessionId = generateSessionId()
    setCookie = setSessionCookieHeader(sessionId)
  }
  return { sessionId, setCookie }
}

// Helper to check if a session has too many active inboxes
export async function checkInboxQuota(sessionId: string): Promise<{ ok: boolean; count: number }> {
  const count = await db.inbox.count({
    where: { sessionId, expiresAt: { gt: new Date() } },
  })
  return { ok: count < QUOTAS.MAX_ACTIVE_INBOXES_PER_SESSION, count }
}

// Generate a full email address
export function buildEmailAddress(local: string, domain: string): string {
  return `${local}@${domain}`
}

// Simple HTML sanitization summary — count external resources that would be blocked
export function countExternalResources(html: string): number {
  let count = 0
  // img tags with http(s) src
  count += (html.match(/<img[^>]+src=["']https?:\/\//gi) || []).length
  // external stylesheets
  count += (html.match(/<link[^>]+href=["']https?:\/\//gi) || []).length
  // external scripts (blocked entirely)
  count += (html.match(/<script[^>]+src=["']https?:\/\//gi) || []).length
  return count
}
