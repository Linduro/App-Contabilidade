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
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
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

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
