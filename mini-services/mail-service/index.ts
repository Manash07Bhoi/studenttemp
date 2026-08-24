// StudentTemp mail-service — Socket.IO server (port 3003)
// - Clients subscribe to their inboxes (by email)
// - Periodically generates realistic mock emails for active inboxes
// - Persists messages via Prisma
// - Emits real-time events to subscribed clients
// - Handles inbox expiration checks

import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { generateEmail } from './content.ts'

const db = new PrismaClient()
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// email -> Set<socketId>  (multiple tabs/devices per inbox)
const subscribers = new Map<string, Set<string>>()

// sessionId -> Set<socketId>
const sessionSubscribers = new Map<string, Set<string>>()

function subscribe(map: Map<string, Set<string>>, key: string, socketId: string) {
  if (!map.has(key)) map.set(key, new Set())
  map.get(key)!.add(socketId)
}
function unsubscribe(map: Map<string, Set<string>>, key: string, socketId: string) {
  const set = map.get(key)
  if (!set) return
  set.delete(socketId)
  if (set.size === 0) map.delete(key)
}

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // Client subscribes to an inbox's email
  socket.on('inbox:subscribe', (data: { email: string }) => {
    if (!data?.email) return
    subscribe(subscribers, data.email, socket.id)
    console.log(`[socket] ${socket.id} subscribed to inbox ${data.email} (total: ${subscribers.get(data.email)?.size})`)
  })

  socket.on('inbox:unsubscribe', (data: { email: string }) => {
    if (data?.email) unsubscribe(subscribers, data.email, socket.id)
  })

  socket.on('session:subscribe', (data: { sessionId: string }) => {
    if (!data?.sessionId) return
    subscribe(sessionSubscribers, data.sessionId, socket.id)
  })

  // Client requests a new message be generated immediately (for demo / manual trigger)
  socket.on('inbox:generate', async (data: { email: string }) => {
    if (!data?.email) return
    const msg = await createMessageForInbox(data.email)
    if (msg) {
      io.to(socket.id).emit('message:generated', { ok: true, messageId: msg.id })
    } else {
      io.to(socket.id).emit('message:generated', { ok: false, error: 'inbox not found or expired' })
    }
  })

  socket.on('disconnect', () => {
    // cleanup all subscriptions
    for (const [email, set] of subscribers.entries()) {
      set.delete(socket.id)
      if (set.size === 0) subscribers.delete(email)
    }
    for (const [sid, set] of sessionSubscribers.entries()) {
      set.delete(socket.id)
      if (set.size === 0) sessionSubscribers.delete(sid)
    }
    console.log(`[socket] disconnected: ${socket.id}`)
  })

  socket.on('error', (err) => console.error(`[socket] error ${socket.id}:`, err))
})

// ----- Message generation + persistence -----
async function createMessageForInbox(email: string) {
  try {
    const inbox = await db.inbox.findUnique({ where: { email } })
    if (!inbox) return null
    if (inbox.expiresAt < new Date()) return null

    const gen = generateEmail()
    const msg = await db.message.create({
      data: {
        inboxId: inbox.id,
        fromEmail: gen.fromEmail,
        fromName: gen.fromName,
        subject: gen.subject,
        previewText: gen.previewText,
        bodyText: gen.bodyText,
        bodyHtml: gen.bodyHtml,
        isRead: false,
        isStarred: false,
        spf: gen.spf,
        dkim: gen.dkim,
        dmarc: gen.dmarc,
        scanStatus: 'clean',
        hasAttachment: gen.hasAttachment,
        attachments: JSON.stringify(gen.attachments),
        category: gen.category,
        externalResourcesBlocked: gen.externalResourcesBlocked,
        isReported: false,
      },
    })

    // Emit to all subscribers of this inbox
    const set = subscribers.get(email)
    if (set) {
      for (const sid of set) {
        io.to(sid).emit('message:new', {
          id: msg.id,
          inboxId: inbox.id,
          email: inbox.email,
          fromEmail: msg.fromEmail,
          fromName: msg.fromName,
          subject: msg.subject,
          previewText: msg.previewText,
          receivedAt: msg.receivedAt,
          category: msg.category,
          isRead: false,
          hasAttachment: msg.hasAttachment,
          scanStatus: msg.scanStatus,
        })
      }
    }
    console.log(`[mail] delivered message to ${email}: "${msg.subject}"`)
    return msg
  } catch (e) {
    console.error('[mail] createMessageForInbox error:', e)
    return null
  }
}

// ----- Periodic generation loop -----
// For each active inbox that has at least one subscriber, randomly generate messages.
const GENERATION_INTERVAL_MS = 12000 // 12s
setInterval(async () => {
  try {
    const now = new Date()
    // Only target inboxes with active subscribers OR randomly selected active inboxes created in last 10 min
    const activeInboxes = await db.inbox.findMany({
      where: { expiresAt: { gt: now } },
      select: { email: true },
    })

    for (const inbox of activeInboxes) {
      // Higher chance if there's an active subscriber
      const hasSub = subscribers.has(inbox.email)
      const chance = hasSub ? 0.45 : 0.12
      if (Math.random() < chance) {
        await createMessageForInbox(inbox.email)
      }
    }
  } catch (e) {
    console.error('[mail] generation loop error:', e)
  }
}, GENERATION_INTERVAL_MS)

// ----- Expiration sweep -----
const EXPIRY_SWEEP_MS = 30000 // 30s
setInterval(async () => {
  try {
    const now = new Date()
    const expired = await db.inbox.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true, email: true, sessionId: true },
    })
    for (const inbox of expired) {
      // Notify session subscribers that the inbox expired
      const sessSet = sessionSubscribers.get(inbox.sessionId)
      if (sessSet) {
        for (const sid of sessSet) {
          io.to(sid).emit('inbox:expired', { inboxId: inbox.id, email: inbox.email })
        }
      }
    }
    if (expired.length) {
      // Delete expired inboxes (cascade messages)
      await db.inbox.deleteMany({ where: { id: { in: expired.map(i => i.id) } } })
      console.log(`[mail] expired & deleted ${expired.length} inboxes`)
    }
  } catch (e) {
    console.error('[mail] expiry sweep error:', e)
  }
}, EXPIRY_SWEEP_MS)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[mail-service] Socket.IO server running on port ${PORT}`)
  console.log(`[mail-service] generation interval: ${GENERATION_INTERVAL_MS}ms, expiry sweep: ${EXPIRY_SWEEP_MS}ms`)
})

process.on('SIGTERM', () => {
  console.log('[mail-service] SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[mail-service] SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
