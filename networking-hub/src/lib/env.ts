import { z } from "zod"

const envSchema = z
  .object({
    DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
    REDIS_URL: z.string().min(1),
    EMBEDDING_PROVIDER: z.enum(["openai", "google"]).default("google"),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENAI_API_KEY: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    WEB3_RPC_URL: z.string().min(1).optional(),
    WEB3_CHAIN_ID: z.coerce.number().int().positive().optional(),
    REPUTATION_SBT_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    CREDENTIAL_NFT_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    SERVICE_ESCROW_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.EMBEDDING_PROVIDER === "openai") {
      if (!data.OPENAI_API_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "OPENAI_API_KEY é obrigatória quando EMBEDDING_PROVIDER=openai",
          path: ["OPENAI_API_KEY"],
        })
      }
    }
    if (data.EMBEDDING_PROVIDER === "google") {
      if (!data.GOOGLE_GENAI_API_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GOOGLE_GENAI_API_KEY é obrigatória quando EMBEDDING_PROVIDER=google",
          path: ["GOOGLE_GENAI_API_KEY"],
        })
      }
    }
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
