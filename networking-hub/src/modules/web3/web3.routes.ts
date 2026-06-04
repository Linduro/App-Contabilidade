import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"
import { ProfileServiceError } from "../profile/profile.service.js"
import { linkWalletSchema } from "./web3.schema.js"
import {
  getCredentialsByWallet,
  getReputationScore,
  getServicesByProvider,
  linkWalletToProfile,
  verifyCredential,
} from "./web3.service.js"
import { isWeb3Configured } from "../../lib/web3.js"

export const web3Routes = new Hono<{ Variables: AuthVariables }>()

web3Routes.get("/status", (c) =>
  c.json({
    configured: isWeb3Configured(),
  })
)

web3Routes.get("/reputation/:walletAddress", async (c) => {
  try {
    const score = await getReputationScore(c.req.param("walletAddress"))
    return c.json({ reputation: score })
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar reputação" },
      400
    )
  }
})

web3Routes.get("/credentials/:walletAddress", async (c) => {
  try {
    const result = await getCredentialsByWallet(c.req.param("walletAddress"))
    return c.json(result)
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar credenciais" },
      400
    )
  }
})

web3Routes.get("/credentials/verify/:tokenId", async (c) => {
  const tokenId = Number(c.req.param("tokenId"))
  if (!Number.isFinite(tokenId) || tokenId < 1) {
    return c.json({ error: "tokenId inválido" }, 400)
  }
  try {
    const result = await verifyCredential(tokenId)
    return c.json(result)
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro na verificação" },
      400
    )
  }
})

web3Routes.get("/services/:walletAddress", async (c) => {
  try {
    const result = await getServicesByProvider(c.req.param("walletAddress"))
    return c.json(result)
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar serviços" },
      400
    )
  }
})

web3Routes.use("/profile/link-wallet", authMiddleware)

web3Routes.post("/profile/link-wallet", async (c) => {
  const authUser = c.get("user")
  const body = linkWalletSchema.safeParse(await c.req.json())

  if (!body.success) {
    return c.json({ error: "Dados inválidos", details: body.error.flatten() }, 400)
  }

  try {
    const profile = await linkWalletToProfile(authUser.id, body.data)
    return c.json({
      profile: {
        id: profile.id,
        walletAddress: profile.walletAddress,
      },
      message: "Wallet vinculada ao perfil",
    })
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      return c.json(
        { error: err.message, code: err.code },
        err.status as ContentfulStatusCode
      )
    }
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao vincular wallet" },
      400
    )
  }
})
