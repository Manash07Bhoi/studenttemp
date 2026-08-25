// POST /api/auth/logout — Logout (revoke session)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clearAccountCookie } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('st_account')?.value
  if (token) {
    await db.loginSession.updateMany({
      where: { id: token },
      data: { revoked: true },
    })
  }
  const res = NextResponse.json({ ok: true })
  res.headers.set('set-cookie', clearAccountCookie())
  return res
}
