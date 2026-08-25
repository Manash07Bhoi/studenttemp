// GET /api/accounts/sent — List sent messages with delivery status
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const sent = await db.sentMessage.findMany({
    where: { accountId },
    orderBy: { sentAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ messages: sent })
}
