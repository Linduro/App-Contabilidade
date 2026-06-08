import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../.env") });

export const env = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "contabilidade-ebed6",
  cronScrapeSchedule: process.env.CRON_SCRAPE_SCHEDULE ?? "0 */6 * * *",
  cronClassifySchedule: process.env.CRON_CLASSIFY_SCHEDULE ?? "15 */6 * * *",
  pythonPath: process.env.PYTHON_PATH ?? "python",
  classifierUrl: process.env.CLASSIFIER_URL || null,
  classifierMinConfidence: parseFloat(
    process.env.CLASSIFIER_MIN_CONFIDENCE ?? "0.3",
  ),
  classifierTimeoutMs: parseInt(
    process.env.CLASSIFIER_TIMEOUT_MS ?? "30000",
    10,
  ),
  cronCollectSchedule: process.env.CRON_COLLECT_SCHEDULE ?? "0 */6 * * *",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
} as const;

export function isFirestoreConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  );
}

/** @deprecated use isFirestoreConfigured */
export function isSupabaseConfigured(): boolean {
  return isFirestoreConfigured();
}
