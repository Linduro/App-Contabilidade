import { getEnv } from "./env.js"

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" as const
export const OPENAI_EMBEDDING_DIMENSIONS = 1536 as const

export async function createOpenAIEmbedding(text: string): Promise<number[]> {
  const apiKey = getEnv().OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: OPENAI_EMBEDDING_DIMENSIONS,
    }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `OpenAI embeddings falhou (${res.status})`)
  }

  const data = (await res.json()) as { data?: { embedding?: number[] }[] }
  const vector = data.data?.[0]?.embedding
  if (!vector?.length) {
    throw new Error("OpenAI não retornou embedding")
  }

  return vector
}
