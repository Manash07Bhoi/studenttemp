// Seed real operator-owned domains into the database.
// These are the only domains this service will ever accept mail for.
// Run with: bun run prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DOMAINS = [
  { domain: 'studentbox.in', pack: 'indian_student', reputationScore: 100 },
  { domain: 'campusmail.in', pack: 'indian_student', reputationScore: 95 },
  { domain: 'examprep.in', pack: 'indian_student', reputationScore: 92 },
  { domain: 'devtest.in', pack: 'standard', reputationScore: 90 },
  { domain: 'quickmail.in', pack: 'standard', reputationScore: 88 },
]

async function main() {
  for (const d of DOMAINS) {
    await db.domain.upsert({
      where: { domain: d.domain },
      update: {},
      create: {
        domain: d.domain,
        pack: d.pack,
        mxEnabled: true,
        active: true,
        reputationScore: d.reputationScore,
      },
    })
    console.log(`✓ domain: ${d.domain} (${d.pack})`)
  }
  console.log(`\nSeeded ${DOMAINS.length} domains.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
