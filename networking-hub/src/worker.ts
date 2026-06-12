import { bootstrap } from "./bootstrap.js"
import { isInlineQueue } from "./lib/env.js"
import { startEmbeddingWorker } from "./modules/matching/embedding.job.js"
import { closeRedis } from "./lib/redis.js"
import { closeDb } from "./db/index.js"

await bootstrap()

if (isInlineQueue()) {
  console.info(
    "[worker] Modo local com fila inline — worker Redis não é necessário. Use apenas: npm run dev"
  )
  process.exit(0)
}

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
