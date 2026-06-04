import "./bootstrap.js"
import { genkit } from "genkit"
import { googleAI } from "@genkit-ai/googleai"

/** Instância Genkit com Google AI (usa GOOGLE_GENAI_API_KEY). */
export const ai = genkit({
  plugins: [googleAI()],
})
