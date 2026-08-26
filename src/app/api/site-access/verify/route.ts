// POST /api/site-access/verify — Verify the site access password and set a cookie
// GET  /api/site-access/verify — Check if the current request has a valid access cookie
// DELETE /api/site-access/verify — Clear the access cookie (logout)
//
// This is a site-wide gate for the testing period. Only people who know the
// password can access the website. The password is stored as a SHA-256 hash in
// the SITE_ACCESS_PASSWORD_HASH environment variable — never in plaintext.
//
// On successful POST, sets an HttpOnly, Secure, SameSite=Strict cookie that expires in 30 days.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getClientIp, rateLimit } from '@/lib/mail-utils'

const ACCESS_COOKIE = 'st_access'
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function shouldSetSecure(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return true
  const xff = req.headers.get('x-forwarded-for') || ''
  const peer = xff.split(',').pop()?.trim()
  const trusted = peer === '127.0.0.1' || peer === '::1' || peer === 'localhost'
  if (!trusted) return false
  return req.headers.get('x-forwarded-proto') === 'https'
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// GET — check if the current request has a valid access cookie
export async function GET(req: NextRequest) {
  if (!process.env.SITE_ACCESS_PASSWORD_HASH) {
    return NextResponse.json({ hasAccess: true, gateEnabled: false })
  }
  const token = req.cookies.get(ACCESS_COOKIE)?.value
  if (!token || token.length < 32) {
    return NextResponse.json({ hasAccess: false, gateEnabled: true })
  }
  return NextResponse.json({ hasAccess: true, gateEnabled: true })
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per minute per IP (prevents brute force)
  const ip = getClientIp(req)
  const limit = rateLimit(`site-access:${ip}`, 10, 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a minute.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { password } = body || {}

  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  const expectedHash = process.env.SITE_ACCESS_PASSWORD_HASH
  if (!expectedHash) {
    // If no password is configured, allow access (dev mode without gate)
    const token = crypto.randomBytes(32).toString('hex')
    const secure = shouldSetSecure(req) ? '; Secure' : ''
    const res = NextResponse.json({ ok: true, message: 'No gate configured' })
    res.headers.set('set-cookie', `${ACCESS_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${ACCESS_COOKIE_MAX_AGE}`)
    return res
  }

  // Compare SHA-256 hash of the submitted password with the stored hash
  const submittedHash = sha256(String(password))
  if (submittedHash !== expectedHash) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Generate a random access token (not the password itself)
  const token = crypto.randomBytes(32).toString('hex')
  const secure = shouldSetSecure(req) ? '; Secure' : ''
  const res = NextResponse.json({ ok: true })
  res.headers.set('set-cookie', `${ACCESS_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${ACCESS_COOKIE_MAX_AGE}`)
  return res
}

// DELETE — Clear the access cookie (logout)
export async function DELETE(req: NextRequest) {
  const secure = shouldSetSecure(req) ? '; Secure' : ''
  const res = NextResponse.json({ ok: true })
  res.headers.set('set-cookie', `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`)
  return res
}
