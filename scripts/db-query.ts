// Direct DB query script — shows raw database state
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const cmd = process.argv[2]

async function main() {
  if (cmd === 'accounts') {
    const accounts = await db.account.findMany({ select: { id: true, email: true, displayName: true, status: true, totpEnabled: true } })
    console.log('=== ACCOUNTS ===')
    console.log(JSON.stringify(accounts, null, 2))
  } else if (cmd === 'filters') {
    const filters = await db.filter.findMany({ include: { account: { select: { email: true } } } })
    console.log('=== FILTERS ===')
    for (const f of filters) {
      console.log(JSON.stringify({
        id: f.id,
        account: f.account.email,
        priorityOrder: f.priorityOrder,
        conditions: JSON.parse(f.conditions),
        actions: JSON.parse(f.actions),
        stopProcessing: f.stopProcessing,
      }, null, 2))
    }
  } else if (cmd === 'labels') {
    const labels = await db.label.findMany({ include: { account: { select: { email: true } } } })
    console.log('=== LABELS ===')
    for (const l of labels) {
      console.log(JSON.stringify({
        id: l.id,
        name: l.name,
        color: l.color,
        retentionDays: l.retentionDays,
        isSystemLabel: l.isSystemLabel,
        account: l.account.email,
      }, null, 2))
    }
  } else if (cmd === 'messages') {
    const messages = await db.message.findMany({
      select: { id: true, senderAddress: true, subject: true, isRead: true, isStarred: true, scanStatus: true, receivedAt: true, inbox: { select: { email: true, accountId: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    })
    console.log('=== MESSAGES (last 20) ===')
    console.log(JSON.stringify(messages, null, 2))
  } else if (cmd === 'message' && process.argv[3]) {
    const msg = await db.message.findUnique({
      where: { id: process.argv[3] },
      select: { id: true, senderAddress: true, subject: true, isRead: true, isStarred: true, scanStatus: true, bodyText: true, authSpf: true, authDkim: true, authDmarc: true, receivedAt: true, inbox: { select: { email: true, accountId: true } } },
    })
    console.log('=== MESSAGE ' + process.argv[3] + ' ===')
    console.log(JSON.stringify(msg, null, 2))
  } else if (cmd === 'sent') {
    const sent = await db.sentMessage.findMany({ include: { account: { select: { email: true } } } })
    console.log('=== SENT MESSAGES ===')
    for (const s of sent) {
      console.log(JSON.stringify({
        id: s.id,
        account: s.account.email,
        to: s.to,
        subject: s.subject,
        status: s.status,
        relayProvider: s.relayProvider,
        relayMessageId: s.relayMessageId,
        sentAt: s.sentAt,
        deliveredAt: s.deliveredAt,
        bounceReason: s.bounceReason,
        firstOpenedAt: s.firstOpenedAt,
        openCount: s.openCount,
      }, null, 2))
    }
  } else if (cmd === 'vacation') {
    const vr = await db.vacationResponder.findMany({ include: { account: { select: { email: true } } } })
    console.log('=== VACATION RESPONDERS ===')
    for (const v of vr) {
      console.log(JSON.stringify({
        id: v.id,
        account: v.account.email,
        enabled: v.enabled,
        subject: v.subject,
        contactsOnly: v.contactsOnly,
        repliedTo: JSON.parse(v.repliedTo || '[]'),
        startDate: v.startDate,
        endDate: v.endDate,
      }, null, 2))
    }
  } else if (cmd === 'sessions') {
    const sessions = await db.loginSession.findMany({ include: { account: { select: { email: true } } } })
    console.log('=== LOGIN SESSIONS ===')
    console.log(JSON.stringify(sessions.map(s => ({ id: s.id.slice(0, 12) + '...', account: s.account.email, deviceInfo: s.deviceInfo.slice(0, 50), revoked: s.revoked, lastSeenAt: s.lastSeenAt })), null, 2))
  } else if (cmd === 'inboxes') {
    const inboxes = await db.inbox.findMany({ select: { id: true, email: true, status: true, accountId: true, isPermanent: true, _count: { select: { messages: true } } } })
    console.log('=== INBOXES ===')
    console.log(JSON.stringify(inboxes, null, 2))
  } else if (cmd === 'attachments') {
    const atts = await db.attachment.findMany({ select: { id: true, filename: true, mimeType: true, sizeBytes: true, scanStatus: true, message: { select: { id: true, subject: true } } } })
    console.log('=== ATTACHMENTS ===')
    console.log(JSON.stringify(atts, null, 2))
  } else if (cmd === 'count') {
    const table = process.argv[3]
    if (table) {
      const count = await (db as any)[table].count()
      console.log(`${table}: ${count} rows`)
    }
  } else {
    console.log('Usage: bun db-query.ts <accounts|filters|labels|messages|message <id>|sent|vacation|sessions|inboxes|attachments|count <table>>')
  }
}

main().then(() => db.$disconnect()).catch(e => { console.error(e); db.$disconnect(); process.exit(1) })
