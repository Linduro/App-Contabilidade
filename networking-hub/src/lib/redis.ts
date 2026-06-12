import { Queue, Worker, type JobsOptions } from "bullmq"
import { getEnv, isInlineQueue } from "./env.js"

export const EMBEDDING_QUEUE_NAME = "generate-embedding" as const

export interface EmbeddingJobPayload {
  profileId: string
}

function connectionOptions() {
  return { url: getEnv().REDIS_URL }
}

export function getEmbeddingQueue(): Queue<EmbeddingJobPayload> {
  return new Queue<EmbeddingJobPayload>(EMBEDDING_QUEUE_NAME, {
    connection: connectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  })
}

export async function enqueueEmbeddingJob(
  profileId: string,
  options?: JobsOptions
): Promise<void> {
  if (isInlineQueue()) {
    void import("../modules/matching/embedding.job.js")
      .then(({ processEmbeddingJob }) => processEmbeddingJob({ profileId }))
      .catch((err) => {
        console.error("[embedding:inline] Falhou", { profileId, error: err })
      })
    return
  }

  const queue = getEmbeddingQueue()
  await queue.add(
    "profile",
    { profileId },
    { jobId: `embedding-${profileId}`, ...options }
  )
  console.info("[queue] Job de embedding enfileirado", { profileId })
}

export function createEmbeddingWorker(
  processor: (payload: EmbeddingJobPayload) => Promise<void>
): Worker<EmbeddingJobPayload> {
  return new Worker<EmbeddingJobPayload>(
    EMBEDDING_QUEUE_NAME,
    async (job) => {
      await processor(job.data)
    },
    { connection: connectionOptions() }
  )
}

export async function closeRedis(): Promise<void> {
  if (isInlineQueue()) return
  const queue = getEmbeddingQueue()
  await queue.close()
}
