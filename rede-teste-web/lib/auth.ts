import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"

const secret = process.env.BETTER_AUTH_SECRET || "rede-teste-dev-secret-change-me-32chars"
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3003"

export const auth = betterAuth({
  appName: "Rede Teste",
  secret,
  baseURL,
  trustedOrigins: [baseURL, "http://localhost:3003"],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 5,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: "rede_teste",
  },
})
