// GET /api/analytics — REAL aggregated usage statistics for the current session.
//
// All numbers are computed from actual Message rows in the database (no mocks).
// Returns:
//   - perDay:           messages received per day for the last `rangeDays` days (area chart)
//   - byCategory:       messages grouped by inbox category (donut chart)
//   - topSenders:       top 10 sender addresses by message count (bar chart)
//   - auth:             SPF/DKIM/DMARC breakdown {pass,fail,none} each
//   - totalMessages, totalInboxes, activeInboxes, avgMessagesPerInbox, authPassRate
//   - totalBytes, avgMessageBytes
//   - peakHour:         {hour: 0..23, count} for the busiest hour in the range
//
// Query params:
//   rangeDays — 7 | 14 | 30 (default 14)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateSession } from '@/lib/mail-utils'

const ALLOWED_RANGES = new Set([7, 14, 30])

const CATEGORY_LABELS: Record<string, string> = {
  otp: 'OTP',
  registration: 'Registration',
  newsletter: 'Newsletter',
  social: 'Social',
  shopping: 'Shopping',
  security: 'Security',
  general: 'General',
}

/** Normalize an authSpf/authDkim/authDmarc value into {pass|fail|none}. */
function bucketAuth(value: string): 'pass' | 'fail' | 'none' {
  if (value === 'pass') return 'pass'
  if (value === 'none') return 'none'
  // fail | softfail | neutral | error | unknown
  return 'fail'
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const rawRange = Number(url.searchParams.get('rangeDays') ?? '14')
  const rangeDays = ALLOWED_RANGES.has(rawRange) ? rawRange : 14

  const { sessionId, setCookie } = await getOrCreateSession(req)

  // Range window starts at midnight of (today - rangeDays + 1) local-ish. We use UTC
  // midnight to keep behavior stable across server locales.
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const rangeStart = new Date(todayUTC.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000)

  // Pull the raw rows we need for all aggregations in ONE query.
  // Includes inbox.category for the category grouping (denormalized on Inbox per schema).
  const rows = await db.message.findMany({
    where: {
      inbox: { sessionId },
      receivedAt: { gte: rangeStart },
    },
    select: {
      receivedAt: true,
      sizeBytes: true,
      authSpf: true,
      authDkim: true,
      authDmarc: true,
      senderAddress: true,
      inbox: { select: { category: true } },
    },
    orderBy: { receivedAt: 'desc' },
  })

  // ---- per-day counts (last rangeDays days, oldest first) ----
  const perDayMap = new Map<string, number>()
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
    perDayMap.set(key, 0)
  }
  for (const r of rows) {
    const key = r.receivedAt.toISOString().slice(0, 10)
    if (perDayMap.has(key)) perDayMap.set(key, (perDayMap.get(key) || 0) + 1)
  }
  const perDay = Array.from(perDayMap.entries()).map(([date, count]) => {
    const d = new Date(date + 'T00:00:00Z')
    const label = `${DOW[d.getUTCDay()]} ${d.getUTCDate()}`
    return { date, label, count }
  })

  // ---- by category ----
  const catCounts = new Map<string, number>()
  for (const r of rows) {
    const cat = r.inbox?.category || 'general'
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
  }
  const byCategory = Array.from(catCounts.entries())
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  // ---- top senders (top 10 by count) ----
  const senderCounts = new Map<string, number>()
  for (const r of rows) {
    const s = (r.senderAddress || 'unknown').toLowerCase()
    senderCounts.set(s, (senderCounts.get(s) || 0) + 1)
  }
  const topSenders = Array.from(senderCounts.entries())
    .map(([sender, count]) => ({ sender, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ---- auth breakdown ----
  const auth = {
    spf: { pass: 0, fail: 0, none: 0 },
    dkim: { pass: 0, fail: 0, none: 0 },
    dmarc: { pass: 0, fail: 0, none: 0 },
  }
  let allPassCount = 0
  for (const r of rows) {
    const s = bucketAuth(r.authSpf)
    const k = bucketAuth(r.authDkim)
    const m = bucketAuth(r.authDmarc)
    auth.spf[s]++
    auth.dkim[k]++
    auth.dmarc[m]++
    if (s === 'pass' && k === 'pass' && m === 'pass') allPassCount++
  }

  // ---- totals ----
  const totalMessages = rows.length
  const totalBytes = rows.reduce((acc, r) => acc + (r.sizeBytes || 0), 0)
  const avgMessageBytes = totalMessages > 0 ? Math.round(totalBytes / totalMessages) : 0
  const authPassRate = totalMessages > 0 ? allPassCount / totalMessages : 0

  const [totalInboxes, activeInboxes] = await Promise.all([
    db.inbox.count({ where: { sessionId } }),
    db.inbox.count({ where: { sessionId, status: 'active', expiresAt: { gt: now } } }),
  ])
  const avgMessagesPerInbox = totalInboxes > 0 ? totalMessages / totalInboxes : 0

  // ---- peak hour (UTC) ----
  const hourCounts = new Array(24).fill(0)
  for (const r of rows) {
    hourCounts[r.receivedAt.getUTCHours()]++
  }
  let peakHour: { hour: number; count: number } | null = null
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > 0 && (!peakHour || hourCounts[h] > peakHour.count)) {
      peakHour = { hour: h, count: hourCounts[h] }
    }
  }

  const body = {
    rangeDays,
    generatedAt: now.toISOString(),
    perDay,
    byCategory,
    topSenders,
    auth,
    totalMessages,
    totalInboxes,
    activeInboxes,
    avgMessagesPerInbox,
    authPassRate,
    totalBytes,
    avgMessageBytes,
    peakHour,
  }

  const res = NextResponse.json(body)
  if (setCookie) res.headers.set('Set-Cookie', setCookie)
  return res
}
