import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"
import {
  getProfileByUserId,
  getPublicProfileById,
  listProfiles,
  updateOwnProfile,
  ProfileServiceError,
} from "./profile.service.js"
import { profileListQuerySchema, profileUpdateSchema } from "./profile.schema.js"

export const profileRoutes = new Hono<{ Variables: AuthVariables }>()

profileRoutes.use("/me", authMiddleware)
profileRoutes.use("/me/*", authMiddleware)

profileRoutes.get("/me", async (c) => {
  const authUser = c.get("user")
  const profile = await getProfileByUserId(authUser.id)

  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }

  return c.json({ profile })
})

profileRoutes.put("/me", async (c) => {
  const authUser = c.get("user")
  const body = profileUpdateSchema.safeParse(await c.req.json())

  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const profile = await updateOwnProfile(authUser.id, body.data)
    return c.json({
      profile,
      message: "Perfil atualizado. Embedding será regenerado em background.",
    })
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      return c.json(
        { error: err.message, code: err.code },
        err.status as ContentfulStatusCode
      )
    }
    throw err
  }
})

profileRoutes.get("/", async (c) => {
  const query = profileListQuerySchema.safeParse(c.req.query())
  if (!query.success) {
    return c.json({ error: "Query inválida", details: query.error.flatten() }, 400)
  }

  const result = await listProfiles(query.data)
  return c.json(result)
})

profileRoutes.get("/:id", async (c) => {
  const profile = await getPublicProfileById(c.req.param("id"))
  if (!profile) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }
  return c.json({ profile })
})
