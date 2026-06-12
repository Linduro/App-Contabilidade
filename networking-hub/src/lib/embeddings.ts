import { getEnv } from "./env.js"
import { createMockEmbedding } from "./mock-embedding.js"
import { createOpenAIEmbedding } from "./openai.js"
import { createGoogleGenAIEmbedding } from "./google-genai.js"

export async function createEmbedding(text: string): Promise<number[]> {
  const provider = getEnv().EMBEDDING_PROVIDER
  if (provider === "mock") {
    return createMockEmbedding(text)
  }
  if (provider === "openai") {
    return createOpenAIEmbedding(text)
  }
  return createGoogleGenAIEmbedding(text)
}
