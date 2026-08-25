// GET /api/challenge — get a proof-of-work challenge (free Turnstile alternative)
// POST /api/challenge/verify — verify a PoW solution
import { NextRequest, NextResponse } from 'next/server'
import { generateChallenge, verifyChallenge } from '@/lib/pow-challenge'

export async function GET() {
  const challenge = generateChallenge(3) // 3 hex zeros = ~4096 attempts on average
  return NextResponse.json(challenge)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { challengeId, solution } = body || {}
  if (!challengeId || !solution) {
    return NextResponse.json({ error: 'Missing challengeId or solution' }, { status: 400 })
  }
  const valid = verifyChallenge(challengeId, solution)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 403 })
  }
  // Return a short-lived token that the client can use for rate-limited endpoints
  return NextResponse.json({ ok: true, token: challengeId })
}
