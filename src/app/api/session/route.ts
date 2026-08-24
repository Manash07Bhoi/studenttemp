// GET  /api/session — get current session info + recovery code (only if just minted)
// POST /api/session/recover — recover a session from a recovery code
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionId, hashToken, generateSessionToken, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE, getOrCreateSession } from '@/lib/mail-utils'

export async function GET(req: NextRequest) {
  const { sessionId } = await getOrCreateSession(req)
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { id: true, createdAt: true, expiresAt: true, maxInboxes: true, locale: true, _count: { select: { inboxes: true } } },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  return NextResponse.json({ session })
}

// POST /api/session/recover — exchange recovery code (ST-XXXX-XXXX) for a new session cookie
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body.code || '').trim().toUpperCase()
  if (!/^ST-[A-Z2-7]{4}-[A-Z2-7]{4}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }
  const tokenHash = hashToken(code)
  const session = await db.session.findUnique({ where: { tokenHash } })
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Recovery code not found or expired' }, { status: 404 })
  }
  // Mint a NEW token (recovery code stays the same; we just set a fresh cookie value = the same code)
  const setCookie = `${SESSION_COOKIE}=${code}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_COOKIE_MAX_AGE}`
  return NextResponse.json({ ok: true, sessionId: session.id, setCookie })
}
