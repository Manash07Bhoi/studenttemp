import { PrismaClient } from '@prisma/client'

/**
 * Prisma client — configured for both local dev (SQLite) and production (Neon Postgres).
 *
 * In development: uses SQLite (DATABASE_URL=file:...)
 * In production (Cloudflare Pages): uses Neon Postgres via the connection string
 *   set in the Cloudflare dashboard (DATABASE_URL=postgresql://...)
 *
 * Neon's serverless driver is automatically used by Prisma 6+ when the
 * DATABASE_URL points to a Neon host (*.neon.tech). No additional adapter
 * configuration is needed — Prisma detects the Neon URL format and uses
 * the appropriate driver.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
