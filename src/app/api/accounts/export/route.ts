// GET /api/accounts/export — Export all account data as a JSON archive
// Returns a real JSON file with all messages, attachments metadata, labels, contacts, etc.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
      recoveryEmail: true,
      recoveryPhone: true,
      totpEnabled: true,
      storageQuotaBytes: true,
      storageUsedBytes: true,
      createdAt: true,
    },
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const [labels, filters, contacts, drafts, sentMessages, aliases, inboxes] = await Promise.all([
    db.label.findMany({ where: { accountId }, include: { childLabels: true } }),
    db.filter.findMany({ where: { accountId } }),
    db.contact.findMany({ where: { accountId } }),
    db.draft.findMany({ where: { accountId } }),
    db.sentMessage.findMany({ where: { accountId } }),
    db.accountAlias.findMany({ where: { accountId } }),
    db.inbox.findMany({
      where: { accountId },
      include: {
        messages: {
          select: {
            id: true,
            senderAddress: true,
            senderDisplayName: true,
            subject: true,
            bodyText: true,
            receivedAt: true,
            isRead: true,
            isStarred: true,
            hasAttachment: true,
            sizeBytes: true,
            authSpf: true,
            authDkim: true,
            authDmarc: true,
            attachments: { select: { filename: true, mimeType: true, sizeBytes: true } },
          },
        },
      },
    }),
  ])

  // Calculate real storage usage
  const totalBytes = inboxes.reduce((sum, inbox) =>
    sum + inbox.messages.reduce((s, m) => s + m.sizeBytes + m.attachments.reduce((a, att) => a + att.sizeBytes, 0), 0), 0
  )

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: {
      ...account,
      storageQuotaBytes: account.storageQuotaBytes.toString(),
      storageUsedBytes: account.storageUsedBytes.toString(),
    },
    labels,
    filters: filters.map(f => ({
      ...f,
      conditions: JSON.parse(f.conditions),
      actions: JSON.parse(f.actions),
    })),
    contacts,
    drafts,
    sentMessages,
    aliases,
    inboxes: inboxes.map(i => ({
      ...i,
      messages: i.messages.map(m => ({
        ...m,
        attachments: m.attachments,
      })),
    })),
    storageSummary: {
      totalBytes,
      totalMessages: inboxes.reduce((s, i) => s + i.messages.length, 0),
      totalAttachments: inboxes.reduce((s, i) => s + i.messages.reduce((ms, m) => ms + m.attachments.length, 0), 0),
    },
  }

  const json = JSON.stringify(exportData, null, 2)
  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="studenttemp-export-${account.email}-${Date.now()}.json"`,
    },
  })
}
