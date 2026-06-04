import { GoogleGenAI } from "@google/genai"
import { getEnv } from "./env.js"

let client: GoogleGenAI | null = null

export function getGoogleGenAI(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getEnv().GOOGLE_GENAI_API_KEY })
  }
  return client
}

/** Compatível com pgvector profiles.embedding vector(1536) */
export const EMBEDDING_MODEL = "gemini-embedding-001" as const
export const EMBEDDING_DIMENSIONS = 1536 as const

export async function createGoogleGenAIEmbedding(text: string): Promise<number[]> {
  const ai = getGoogleGenAI()

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  })

  const vector = response.embeddings?.[0]?.values
  if (!vector?.length) {
    throw new Error("Google GenAI não retornou embedding")
  }

  return vector
}
