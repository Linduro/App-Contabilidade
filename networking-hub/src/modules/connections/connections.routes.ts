import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"
import { getProfileByUserId } from "../profile/profile.service.js"
import {
  connectionListQuerySchema,
  createConnectionSchema,
  updateConnectionSchema,
} from "./connections.schema.js"
import {
  createConnection,
  ConnectionsServiceError,
  listConnections,
  listPendingReceived,
  updateConnectionStatus,
} from "./connections.service.js"

export const connectionsRoutes = new Hono<{ Variables: AuthVariables }>()

connectionsRoutes.use("*", authMiddleware)

async function requireProfileId(userId: string) {
  const profile = await getProfileByUserId(userId)
  if (!profile) return null
  return profile.id
}

connectionsRoutes.get("/pending", async (c) => {
  const authUser = c.get("user")
  const profileId = await requireProfileId(authUser.id)
  if (!profileId) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }

  const pending = await listPendingReceived(profileId)
  return c.json({ connections: pending, count: pending.length })
})

connectionsRoutes.get("/", async (c) => {
  const authUser = c.get("user")
  const profileId = await requireProfileId(authUser.id)
  if (!profileId) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }

  const query = connectionListQuerySchema.safeParse(c.req.query())
  if (!query.success) {
    return c.json({ error: "Query inválida", details: query.error.flatten() }, 400)
  }

  const list = await listConnections(profileId, query.data)
  return c.json({ connections: list })
})

connectionsRoutes.post("/", async (c) => {
  const authUser = c.get("user")
  const profileId = await requireProfileId(authUser.id)
  if (!profileId) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }

  const body = createConnectionSchema.safeParse(await c.req.json())
  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const connection = await createConnection(profileId, body.data.targetProfileId)
    return c.json({ connection }, 201)
  } catch (err) {
    if (err instanceof ConnectionsServiceError) {
      return c.json(
        { error: err.message, code: err.code },
        err.status as ContentfulStatusCode
      )
    }
    throw err
  }
})

connectionsRoutes.patch("/:id", async (c) => {
  const authUser = c.get("user")
  const profileId = await requireProfileId(authUser.id)
  if (!profileId) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }

  const body = updateConnectionSchema.safeParse(await c.req.json())
  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const connection = await updateConnectionStatus(
      c.req.param("id"),
      profileId,
      body.data
    )
    return c.json({ connection })
  } catch (err) {
    if (err instanceof ConnectionsServiceError) {
      return c.json(
        { error: err.message, code: err.code },
        err.status as ContentfulStatusCode
      )
    }
    throw err
  }
})
