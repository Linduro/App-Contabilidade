import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://127.0.0.1:5432/portal?schema=public";

function stripSslQueryParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/([?&])uselibpqcompat=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function isRemoteManagedPostgres(url: string): boolean {
  return (
    url.includes("supabase.co") ||
    url.includes("render.com") ||
    url.includes("neon.tech")
  );
}

function createPgPool(url: string): pg.Pool {
  const remoteSsl = isRemoteManagedPostgres(url);
  return new pg.Pool({
    connectionString: remoteSsl ? stripSslQueryParams(url) : url,
    ...(remoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: url.includes("supabase.co") ? 12 : 20,
    connectionTimeoutMillis: url.includes("supabase.co") ? 15_000 : 10_000,
  });
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join(process.cwd(), "prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrate: {
    adapter: () => new PrismaPg(createPgPool(databaseUrl)),
  },
});
