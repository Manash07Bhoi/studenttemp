
import { execSync } from 'child_process';
try {
  console.log("Running prisma generate BEFORE loading server...");
  execSync('bunx prisma generate', { stdio: 'inherit' });
  console.log("Prisma generate completed.");
} catch (err) {
  console.error("Failed to generate Prisma client:", err);
}

// Dynamically import the real server so PrismaClient is imported AFTER generation
import("./server");
