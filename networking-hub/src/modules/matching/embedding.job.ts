import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { profiles } from "../../db/schema.js"
import { createEmbedding } from "../../lib/embeddings.js"
import { createEmbeddingWorker, type EmbeddingJobPayload } from "../../lib/redis.js"
import { buildProfileEmbeddingText } from "./embedding-text.js"

export { buildProfileEmbeddingText } from "./embedding-text.js"

export async function processEmbeddingJob(payload: EmbeddingJobPayload): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, payload.profileId),
  })

  if (!profile) {
    console.warn("[embedding] Perfil não encontrado", payload.profileId)
    return
  }

  const text = buildProfileEmbeddingText(profile)
  console.info("[embedding] Gerando vetor", { profileId: profile.id })

  const vector = await createEmbedding(text)

  await db
    .update(profiles)
    .set({
      embedding: vector,
      embeddingGeradoEm: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id))

  console.info("[embedding] Concluído", { profileId: profile.id })
}

export function startEmbeddingWorker(): ReturnType<typeof createEmbeddingWorker> {
  const worker = createEmbeddingWorker(processEmbeddingJob)

  worker.on("completed", (job) => {
    console.info("[embedding] Job OK", { jobId: job.id })
  })

  worker.on("failed", (job, err) => {
    console.error("[embedding] Job falhou", { jobId: job?.id, error: err.message })
  })

  console.info("[embedding] Worker iniciado")
  return worker
}
