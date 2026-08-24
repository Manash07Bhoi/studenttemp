// GET /api/domains — list real operator-owned domains from DB
import { NextResponse } from 'next/server'
import { getDomains, INBOX_LIFETIME_OPTIONS, CATEGORY_PRESETS, QUOTAS } from '@/lib/mail-utils'

export async function GET() {
  const domains = await getDomains()
  return NextResponse.json({
    domains,
    lifetimeOptions: INBOX_LIFETIME_OPTIONS,
    categories: CATEGORY_PRESETS,
    quotas: QUOTAS,
    // Surface real SMTP server info for the UI
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 2525,
      domains: domains.map(d => d.domain),
    },
  })
}
