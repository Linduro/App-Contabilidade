/**
 * Modo local: roda sem arquivo .env (Postgres em arquivo + embeddings mock).
 * Ative explicitamente com NETWORKING_LOCAL=true ou deixe sem DATABASE_URL.
 */
function needsLocalDatabase(url?: string): boolean {
  const v = url?.trim()
  if (!v) return true
  return !v.startsWith("postgresql://") && !v.startsWith("postgres://")
}

export function applyNetworkingDevDefaults(): void {
  const explicit = process.env.NETWORKING_LOCAL === "true"
  const missingDb = needsLocalDatabase(process.env.DATABASE_URL)
  if (!explicit && !missingDb) return

  process.env.NETWORKING_LOCAL ??= "true"
  process.env.STORAGE_MODE ??= "pglite"
  process.env.DATABASE_URL ??= "pglite://local"
  process.env.REDIS_URL ??= "inline"
  process.env.EMBEDDING_PROVIDER ??= "mock"
  process.env.BETTER_AUTH_SECRET ??=
    "dev-networking-local-secret-change-in-production-32"
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
  process.env.PORT ??= "3000"
  process.env.NODE_ENV ??= "development"
  process.env.WEB3_ENABLED ??= "false"

  console.info(
    "[networking] Modo local ativo — sem .env obrigatório (PGlite + embeddings mock, fila inline)"
  )
}
