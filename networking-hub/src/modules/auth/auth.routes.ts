import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { z } from "zod"
import {
  getUserBySessionToken,
  loginUser,
  logoutByToken,
  registerUser,
  AuthServiceError,
} from "./auth.service.js"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nome: z.string().min(2).max(120),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const authRoutes = new Hono<{ Variables: AuthVariables }>()

authRoutes.post("/register", async (c) => {
  const body = registerSchema.safeParse(await c.req.json())
  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const result = await registerUser(body.data)
    return c.json(result, 201)
  } catch (err) {
    return handleAuthError(c, err)
  }
})

authRoutes.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json())
  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const result = await loginUser(body.data)
    return c.json(result)
  } catch (err) {
    return handleAuthError(c, err)
  }
})

authRoutes.post("/logout", authMiddleware, async (c) => {
  const token = c.get("token")
  if (token) await logoutByToken(token)
  return c.json({ success: true })
})

authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user")
  return c.json({ user })
})

function handleAuthError(
  c: { json: (body: unknown, status?: ContentfulStatusCode) => Response },
  err: unknown
) {
  if (err instanceof AuthServiceError) {
    return c.json(
      { error: err.message, code: err.code },
      err.status as ContentfulStatusCode
    )
  }
  console.error("[auth]", err)
  return c.json({ error: "Erro interno de autenticação" }, 500)
}
