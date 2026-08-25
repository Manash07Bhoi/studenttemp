// GET /api/admin/stats — Admin dashboard system stats (PRD Screen 14)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  // Simple admin check — in production this would check an admin role
  const accountId = await getAccountId()
  // For now, allow any authenticated account to see basic stats
  // In production: check if account has admin role
  if (!accountId) {
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

  // Storage usage
  const totalStorageUsed = await db.account.aggregate({ _sum: { storageUsedBytes: true } })

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
      totalStorageUsed: totalStorageUsed._sum.storageUsedBytes || 0,
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
