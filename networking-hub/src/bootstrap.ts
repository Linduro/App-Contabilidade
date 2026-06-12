import { applyNetworkingDevDefaults } from "./lib/dev-defaults.js"
import { initDatabase, getDb } from "./db/setup.js"
import { users } from "./db/schema.js"
import { runSeedIfEmpty } from "./db/seed-local.js"

export async function bootstrap(): Promise<void> {
  applyNetworkingDevDefaults()
  await initDatabase()

  if (process.env.NETWORKING_LOCAL === "true" && process.env.NETWORKING_AUTO_SEED !== "false") {
    await runSeedIfEmpty(getDb())
  }
}
