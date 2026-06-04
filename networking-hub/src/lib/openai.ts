import OpenAI from "openai"
import { getEnv } from "./env.js"

let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY })
  }
  return client
}

export const EMBEDDING_MODEL = "text-embedding-3-small" as const
export const EMBEDDING_DIMENSIONS = 1536 as const

export async function createEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const vector = response.data[0]?.embedding
  if (!vector) {
    throw new Error("OpenAI não retornou embedding")
  }

  return vector
}
