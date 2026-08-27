import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const migrations = await prisma.$queryRawUnsafe(`SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`);
    console.log("MIGRATIONS_TABLE:", JSON.stringify(migrations));
  } catch (e) {
    console.error("MIGRATIONS_ERROR:", e.message);
  }
}

main().finally(() => prisma.$disconnect());
