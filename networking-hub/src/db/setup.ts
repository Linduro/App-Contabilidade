import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { vector } from "@electric-sql/pglite/vector"
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite"
import postgres from "postgres"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import * as schema from "./schema.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PGlite_DATA_DIR = path.join(process.cwd(), ".data", "networking-pglite")

export type AppDatabase = PgliteDatabase<typeof schema> | ReturnType<typeof drizzlePostgres<typeof schema>>

let dbInstance: AppDatabase | null = null
let pgClient: PGlite | postgres.Sql | null = null
let schemaReady = false

function isPgliteMode(): boolean {
  return (
    process.env.STORAGE_MODE === "pglite" ||
    process.env.DATABASE_URL?.startsWith("pglite://") === true
  )
}

async function initPglite(): Promise<void> {
  fs.mkdirSync(PGlite_DATA_DIR, { recursive: true })
  const client = new PGlite({
    dataDir: PGlite_DATA_DIR,
    extensions: { vector },
  })
  await client.exec("CREATE EXTENSION IF NOT EXISTS vector")
  pgClient = client
  dbInstance = drizzle({ client, schema })

  if (!schemaReady) {
    const sqlPath = path.join(__dirname, "pglite-init.sql")
    const initSql = fs.readFileSync(sqlPath, "utf8")
    await client.exec(initSql)
    schemaReady = true
    console.info("[db] Schema PGlite inicializado")
  }
}

async function initPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL!
  const client = postgres(url, { max: 10, prepare: false })
  pgClient = client
  dbInstance = drizzlePostgres(client, { schema })
}

export async function initDatabase(): Promise<AppDatabase> {
  if (dbInstance) return dbInstance
  if (isPgliteMode()) {
    await initPglite()
  } else {
    await initPostgres()
  }
  return dbInstance!
}

export function getDb(): AppDatabase {
  if (!dbInstance) {
    throw new Error("Banco não inicializado. Aguarde bootstrap() antes de usar db.")
  }
  return dbInstance
}

export async function closeDb(): Promise<void> {
  if (!pgClient) return
  if (isPgliteMode() && pgClient instanceof PGlite) {
    await pgClient.close()
  } else if (typeof (pgClient as postgres.Sql).end === "function") {
    await (pgClient as postgres.Sql).end()
  }
  pgClient = null
  dbInstance = null
}
