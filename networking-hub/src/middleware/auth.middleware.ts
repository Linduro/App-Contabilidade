import type { Context, Next } from "hono"
import { getSessionFromBearer, type AuthUserDto } from "../modules/auth/auth.service.js"

export type AuthVariables = {
  user: AuthUserDto
  token: string
}

export async function authMiddleware(
  c: Context<{ Variables: Partial<AuthVariables> }>,
  next: Next
) {
  const authorization = c.req.header("Authorization")
  const user = await getSessionFromBearer(authorization)

  if (!user) {
    return c.json({ error: "Não autenticado" }, 401)
  }

  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : ""

  c.set("user", user)
  c.set("token", token)
  await next()
}
