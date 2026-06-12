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

/** db.*.supabase.co só tem IPv6; reescreve para pooler IPv4 (Render, etc.). */
export function normalizeSupabaseDatabaseUrl(
  url: string,
  mode: "pooler" | "session" = "pooler",
): string {
  if (!url.includes("db.") || !url.includes(".supabase.co")) return url;
  try {
    const parsed = new URL(url);
    const ref = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
    if (!ref) return url;

    const region = process.env.SUPABASE_DB_REGION?.trim() || "sa-east-1";
    const poolerHost =
      process.env.SUPABASE_POOLER_HOST?.trim() ||
      `aws-1-${region}.pooler.supabase.com`;

    parsed.hostname = poolerHost;
    parsed.port = mode === "session" ? "5432" : "6543";
    if (!parsed.username.includes(".")) {
      parsed.username = `postgres.${ref}`;
    }
    if (mode === "pooler") {
      parsed.searchParams.set("pgbouncer", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveDatabaseUrl(mode: "pooler" | "session" = "pooler"): string {
  const raw =
    mode === "session"
      ? (process.env.DIRECT_DATABASE_URL?.trim() ||
          process.env.DATABASE_URL?.trim() ||
          "")
      : (process.env.DATABASE_URL?.trim() || "");
  if (!raw) {
    return "postgresql://127.0.0.1:5432/portal?schema=public";
  }
  return normalizeSupabaseDatabaseUrl(raw, mode);
}

export function createPgPool(databaseUrl?: string): pg.Pool {
  const url = databaseUrl ?? resolveDatabaseUrl();
  const remoteSsl = isRemoteManagedPostgres(url);
  return new pg.Pool({
    connectionString: remoteSsl ? stripSslQueryParams(url) : url,
    ...(remoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: url.includes("supabase.co") ? 12 : 20,
    min: url.includes("supabase.co") ? 2 : 0,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: url.includes("supabase.co") ? 15_000 : 5_000,
  });
}
