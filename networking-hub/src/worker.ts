import { getEnv } from "./lib/env.js"
import { startEmbeddingWorker } from "./modules/matching/embedding.job.js"
import { closeRedis } from "./lib/redis.js"
import { closeDb } from "./db/index.js"

getEnv()

const worker = startEmbeddingWorker()

async function shutdown(signal: string) {
  console.info(`[worker] Encerrando (${signal})...`)
  await worker.close()
  await closeRedis()
  await closeDb()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
