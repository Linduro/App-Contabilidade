import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { AuthServiceError } from "../modules/auth/auth.service.js"

export function errorMiddleware(err: Error, c: Context) {
  console.error("[error]", {
    path: c.req.path,
    method: c.req.method,
    message: err.message,
    stack: err.stack,
  })

  if (err instanceof AuthServiceError) {
    return c.json(
      { error: err.message, code: err.code },
      err.status as ContentfulStatusCode
    )
  }

  if (err.name === "ZodError") {
    return c.json({ error: "Validação falhou" }, 400)
  }

  return c.json({ error: "Erro interno do servidor" }, 500)
}
