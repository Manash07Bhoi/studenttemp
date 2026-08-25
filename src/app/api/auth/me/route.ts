// GET /api/auth/me — Get current account info
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAccountId } from '@/lib/auth-utils'

export async function GET() {
  const accountId = await getAccountId()
  if (!accountId) {
    return NextResponse.json({ account: null })
  }
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
      status: true,
      createdAt: true,
    },
  })
  if (!account || account.status !== 'active') {
    return NextResponse.json({ account: null })
  }
  // BigInt cannot be JSON.stringify'd; serialize to string for the wire.
  // (Bytes are integers that exceed Number.MAX_SAFE_INTEGER for large quotas.)
  return NextResponse.json({
    account: {
      ...account,
      storageQuotaBytes: account.storageQuotaBytes.toString(),
      storageUsedBytes: account.storageUsedBytes.toString(),
      createdAt: account.createdAt.toISOString(),
    },
  })
}
