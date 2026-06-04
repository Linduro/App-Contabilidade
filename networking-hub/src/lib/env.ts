import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  REDIS_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error("[env] Variáveis inválidas:", parsed.error.flatten().fieldErrors)
    throw new Error("Configuração de ambiente inválida")
  }

  cached = parsed.data
  return cached
}
