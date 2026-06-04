/**
 * Inicialização do Genkit — chame antes de definir flows/plugins.
 * Requer GOOGLE_GENAI_API_KEY (e deploy Firebase/GCP para exportar traces).
 */
import { enableFirebaseTelemetry } from "@genkit-ai/firebase"

enableFirebaseTelemetry()
