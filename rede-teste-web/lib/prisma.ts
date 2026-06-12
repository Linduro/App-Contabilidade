import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaUrl: string | undefined;
}

function stripSslQueryParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/([?&])uselibpqcompat=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function createPrisma(): PrismaClient {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://127.0.0.1:5432/portal?schema=public";
  const useSupabaseSsl = url.includes("supabase.co");
  const pool = new pg.Pool({
    connectionString: useSupabaseSsl ? stripSslQueryParams(url) : url,
    ...(useSupabaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: useSupabaseSsl ? 12 : 20,
    min: useSupabaseSsl ? 2 : 0,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: useSupabaseSsl ? 15_000 : 5_000,
  });
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
