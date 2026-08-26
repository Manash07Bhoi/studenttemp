// GET /api/admin/stats — Admin dashboard system stats (PRD Screen 14)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

// Admin emails — these accounts have access to admin dashboard
const ADMIN_EMAILS = new Set([
  'admin@studentbox.in',
  'roshan@studentbox.in',
])

export async function GET(req: NextRequest) {
  const accountId = await getAccountId()
  if (!accountId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Check if this account has admin privileges
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { email: true, status: true },
  })
  if (!account || account.status !== 'active') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  if (!ADMIN_EMAILS.has(account.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const now = new Date()
  const [
    totalAccounts,
    activeAccounts,
    totalInboxes,
    activeInboxes,
    permanentInboxes,
    totalMessages,
    totalAttachments,
    abuseReports,
    domains,
    filters,
    labels,
    contacts,
    sentMessages,
    drafts,
    loginSessions,
  ] = await Promise.all([
    db.account.count(),
    db.account.count({ where: { status: 'active' } }),
    db.inbox.count(),
    db.inbox.count({ where: { status: 'active', expiresAt: { gt: now } } }),
    db.inbox.count({ where: { isPermanent: true } }),
    db.message.count(),
    db.attachment.count(),
    db.abuseReport.count(),
    db.domain.count({ where: { active: true } }),
    db.filter.count(),
    db.label.count(),
    db.contact.count(),
    db.sentMessage.count(),
    db.draft.count(),
    db.loginSession.count({ where: { revoked: false } }),
  ])

  // Messages in last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const messages24h = await db.message.count({ where: { receivedAt: { gt: yesterday } } })

  // Abuse reports by category
  const abuseByCategory = await db.abuseReport.groupBy({
    by: ['category'],
    _count: true,
  })

  // Storage usage — BigInt must be coerced to string before JSON serialization
  const totalStorageUsedAgg = await db.account.aggregate({ _sum: { storageUsedBytes: true } })
  const totalStorageUsed = totalStorageUsedAgg._sum.storageUsedBytes || BigInt(0)

  return NextResponse.json({
    overview: {
      totalAccounts,
      activeAccounts,
      totalInboxes,
      activeInboxes,
      permanentInboxes,
      totalMessages,
      messages24h,
      totalAttachments,
      abuseReports,
      domains,
      totalStorageUsed: totalStorageUsed.toString(),
    },
    accountMode: {
      filters,
      labels,
      contacts,
      sentMessages,
      drafts,
      activeSessions: loginSessions,
    },
    abuse: {
      total: abuseReports,
      byCategory: abuseByCategory,
    },
    timestamp: now.toISOString(),
  })
}
