import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { getEnv } from "./lib/env.js"
import { errorMiddleware } from "./middleware/error.middleware.js"
import { authRoutes } from "./modules/auth/auth.routes.js"
import { profileRoutes } from "./modules/profile/profile.routes.js"
import { matchingRoutes } from "./modules/matching/matching.routes.js"
import { graphRoutes } from "./modules/graph/graph.routes.js"
import { connectionsRoutes } from "./modules/connections/connections.routes.js"

const app = new Hono()

app.use("*", logger())
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
)

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
)

app.route("/auth", authRoutes)
app.route("/profiles", profileRoutes)
app.route("/matching", matchingRoutes)
app.route("/graph", graphRoutes)
app.route("/connections", connectionsRoutes)

app.onError(errorMiddleware)

const env = getEnv()

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.info(`[api] Networking Hub em http://localhost:${info.port}`)
  }
)
