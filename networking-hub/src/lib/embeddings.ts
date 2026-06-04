import { getEnv } from "./env.js"
import { createOpenAIEmbedding } from "./openai.js"
import { createGoogleGenAIEmbedding } from "./google-genai.js"

export async function createEmbedding(text: string): Promise<number[]> {
  const provider = getEnv().EMBEDDING_PROVIDER
  if (provider === "openai") {
    return createOpenAIEmbedding(text)
  }
  return createGoogleGenAIEmbedding(text)
}
