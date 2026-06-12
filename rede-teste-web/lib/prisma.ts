import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from './pg-connection';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaUrl: string | undefined;
}

function createPrisma(): PrismaClient {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://127.0.0.1:5432/portal?schema=public";
  const pool = createPgPool(url);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });
}

/** Client em cache pode ficar sem delegates novos após `prisma generate` sem reiniciar o dev server. */
function prismaMissingMinutaDelegate(client: PrismaClient): boolean {
  return !("minutaReview" in client) || client.minutaReview == null;
}

function disconnectStale(client: PrismaClient | undefined) {
  if (!client) return;
  void client.$disconnect().catch(() => {});
}

export const prisma = (() => {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://127.0.0.1:5432/portal?schema=public";
  if (global.__prisma && global.__prismaUrl !== url) {
    disconnectStale(global.__prisma);
    global.__prisma = undefined;
  }
  if (global.__prisma && prismaMissingMinutaDelegate(global.__prisma)) {
    disconnectStale(global.__prisma);
    global.__prisma = undefined;
  }
  global.__prismaUrl = url;
  if (!global.__prisma) {
    global.__prisma = createPrisma();
  }
  return global.__prisma;
})();
