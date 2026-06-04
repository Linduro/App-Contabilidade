import { Hono } from "hono"
import { getExpertiseWeb, getProfileNetwork } from "./graph.service.js"

export const graphRoutes = new Hono()

graphRoutes.get("/expertise-web", async (c) => {
  const graph = await getExpertiseWeb()
  return c.json(graph)
})

graphRoutes.get("/profile/:id/network", async (c) => {
  const graph = await getProfileNetwork(c.req.param("id"))
  if (!graph) {
    return c.json({ error: "Perfil não encontrado" }, 404)
  }
  return c.json(graph)
})
