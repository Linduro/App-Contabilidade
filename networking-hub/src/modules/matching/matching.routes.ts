import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"
import {
  getMatchSuggestions,
  recalculateEmbeddingForUser,
  MatchingServiceError,
} from "./matching.service.js"

export const matchingRoutes = new Hono<{ Variables: AuthVariables }>()

matchingRoutes.use("/*", authMiddleware)

matchingRoutes.get("/suggestions", async (c) => {
  const user = c.get("user")
  const suggestions = await getMatchSuggestions(user.id)
  return c.json({ suggestions })
})

matchingRoutes.post("/recalculate", async (c) => {
  const user = c.get("user")

  try {
    await recalculateEmbeddingForUser(user.id)
    return c.json({
      message: "Reprocessamento de embedding enfileirado.",
    })
  } catch (err) {
    if (err instanceof MatchingServiceError) {
      return c.json(
        { error: err.message, code: err.code },
        err.status as ContentfulStatusCode
      )
    }
    throw err
  }
})
