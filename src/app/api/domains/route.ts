// GET /api/domains — list available operator-owned domains
import { NextResponse } from 'next/server'
import { DOMAINS, INBOX_LIFETIME_OPTIONS, CATEGORY_PRESETS, QUOTAS } from '@/lib/mail-utils'

export async function GET() {
  return NextResponse.json({
    domains: DOMAINS,
    lifetimeOptions: INBOX_LIFETIME_OPTIONS,
    categories: CATEGORY_PRESETS,
    quotas: QUOTAS,
  })
}
