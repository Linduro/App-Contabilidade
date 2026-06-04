import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { getEnv } from "../lib/env.js"
import * as schema from "./schema.js"

const env = getEnv()

const client = postgres(env.DATABASE_URL, {
  max: 10,
  prepare: false,
})

export const db = drizzle(client, { schema })

export async function closeDb(): Promise<void> {
  await client.end()
}
