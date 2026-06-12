import dns from "node:dns";
import pg from "pg";

// Render e outros hosts sem IPv6 de saída falham em db.*.supabase.co (AAAA-only).
dns.setDefaultResultOrder("ipv4first");

export function stripSslQueryParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/([?&])uselibpqcompat=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

export function isRemoteManagedPostgres(url: string): boolean {
  return (
    url.includes("supabase.co") ||
    url.includes("render.com") ||
    url.includes("neon.tech")
  );
}

export function createPgPool(databaseUrl: string): pg.Pool {
  const remoteSsl = isRemoteManagedPostgres(databaseUrl);
  return new pg.Pool({
    connectionString: remoteSsl ? stripSslQueryParams(databaseUrl) : databaseUrl,
    ...(remoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: databaseUrl.includes("supabase.co") ? 12 : 20,
    min: databaseUrl.includes("supabase.co") ? 2 : 0,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: databaseUrl.includes("supabase.co") ? 15_000 : 5_000,
  });
}
