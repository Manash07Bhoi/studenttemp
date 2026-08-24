// Seed real operator-owned domains into the database.
// These are the only domains this service will ever accept mail for.
// Per PRD §2: never forge real .edu/.ac.in/.edu.in institutional domains.
// All domains below are operator-owned temp mail domains with India-themed
// and international branding.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DOMAINS = [
  // ===== India Student Pack (operator-owned .in domains) =====
  { domain: 'studentbox.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 100 },
  { domain: 'campusmail.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 98 },
  { domain: 'examprep.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 95 },
  { domain: 'collegemail.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 93 },
  { domain: 'studbox.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 92 },
  { domain: 'scholarly.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 90 },
  { domain: 'campusbox.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 89 },
  { domain: 'exambox.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 88 },
  { domain: 'studymail.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 87 },
  { domain: 'testprep.in', pack: 'indian_student', country: 'india', category: 'student', reputationScore: 86 },

  // ===== India General Pack =====
  { domain: 'devtest.in', pack: 'standard', country: 'india', category: 'developer', reputationScore: 90 },
  { domain: 'quickmail.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 88 },
  { domain: 'tempbox.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 85 },
  { domain: 'maildrop.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 84 },
  { domain: 'instantmail.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 83 },
  { domain: 'throwaway.in', pack: 'standard', country: 'india', category: 'privacy', reputationScore: 82 },
  { domain: 'burnmail.in', pack: 'standard', country: 'india', category: 'privacy', reputationScore: 81 },
  { domain: 'disposable.in', pack: 'standard', country: 'india', category: 'privacy', reputationScore: 80 },
  { domain: 'fastmail.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 79 },
  { domain: 'smartmail.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 78 },
  { domain: 'inboxhero.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 77 },
  { domain: 'mailstation.in', pack: 'standard', country: 'india', category: 'general', reputationScore: 76 },

  // ===== International / Global Domains (.io, .com, .org) =====
  { domain: 'tempmail.io', pack: 'international', country: 'global', category: 'general', reputationScore: 95 },
  { domain: 'quickbox.io', pack: 'international', country: 'global', category: 'general', reputationScore: 93 },
  { domain: 'studentmail.io', pack: 'international', country: 'global', category: 'student', reputationScore: 92 },
  { domain: 'campusmail.io', pack: 'international', country: 'global', category: 'student', reputationScore: 91 },
  { domain: 'tempinbox.com', pack: 'international', country: 'global', category: 'general', reputationScore: 90 },
  { domain: 'quickinbox.com', pack: 'international', country: 'global', category: 'general', reputationScore: 89 },
  { domain: 'mailtemp.com', pack: 'international', country: 'global', category: 'general', reputationScore: 88 },
  { domain: 'disposablemail.com', pack: 'international', country: 'global', category: 'privacy', reputationScore: 87 },
  { domain: 'throwbox.com', pack: 'international', country: 'global', category: 'privacy', reputationScore: 86 },
  { domain: 'tempmail.org', pack: 'international', country: 'global', category: 'general', reputationScore: 85 },
  { domain: 'burnbox.org', pack: 'international', country: 'global', category: 'privacy', reputationScore: 84 },
  { domain: 'studmail.com', pack: 'international', country: 'global', category: 'student', reputationScore: 83 },
  { domain: 'devmail.io', pack: 'international', country: 'global', category: 'developer', reputationScore: 82 },
  { domain: 'testmail.io', pack: 'international', country: 'global', category: 'testing', reputationScore: 81 },
  { domain: 'inboxdrop.com', pack: 'international', country: 'global', category: 'general', reputationScore: 80 },
  { domain: 'mailcatch.com', pack: 'international', country: 'global', category: 'general', reputationScore: 79 },
  { domain: 'tempbox.com', pack: 'international', country: 'global', category: 'general', reputationScore: 78 },
  { domain: 'flashmail.io', pack: 'international', country: 'global', category: 'quick', reputationScore: 77 },
  { domain: 'snapmail.io', pack: 'international', country: 'global', category: 'quick', reputationScore: 76 },
  { domain: 'onetemp.com', pack: 'international', country: 'global', category: 'quick', reputationScore: 75 },

  // ===== Privacy-Focused Domains =====
  { domain: 'privatemail.in', pack: 'privacy', country: 'india', category: 'privacy', reputationScore: 85 },
  { domain: 'anonmail.in', pack: 'privacy', country: 'india', category: 'privacy', reputationScore: 84 },
  { domain: 'ghostmail.io', pack: 'privacy', country: 'global', category: 'privacy', reputationScore: 83 },
  { domain: 'shieldmail.com', pack: 'privacy', country: 'global', category: 'privacy', reputationScore: 82 },
  { domain: 'safemail.in', pack: 'privacy', country: 'india', category: 'privacy', reputationScore: 81 },
]

async function main() {
  for (const d of DOMAINS) {
    await db.domain.upsert({
      where: { domain: d.domain },
      update: {},
      create: {
        domain: d.domain,
        pack: d.pack,
        country: d.country,
        category: d.category,
        mxEnabled: true,
        active: true,
        reputationScore: d.reputationScore,
      },
    })
  }
  console.log(`Seeded ${DOMAINS.length} domains.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
