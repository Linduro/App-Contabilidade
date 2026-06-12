import { Hono } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { authMiddleware, type AuthVariables } from "../../middleware/auth.middleware.js"
import { ProfileServiceError } from "../profile/profile.service.js"
import { linkWalletSchema } from "./web3.schema.js"
import {
  getCredentialsByWallet,
  getReputationScore,
  getProviderServices,
  linkWalletToProfile,
  verifyCredential,
  isWeb3Configured,
  isWeb3Enabled,
} from "./web3.service.js"

export const web3Routes = new Hono<{ Variables: AuthVariables }>()

const WEB3_DISABLED = {
  error: "Integração on-chain desativada (deploy Amoy cancelado).",
  code: "WEB3_DISABLED",
} as const

web3Routes.get("/status", (c) =>
  c.json({
    enabled: isWeb3Enabled(),
    configured: isWeb3Configured(),
    network: "polygon_amoy",
    status: isWeb3Configured() ? "ready" : isWeb3Enabled() ? "missing_contracts" : "disabled",
  })
)

web3Routes.get("/reputation/:walletAddress", async (c) => {
  if (!isWeb3Configured()) {
    return c.json(WEB3_DISABLED, 503)
  }
  const walletAddress = c.req.param("walletAddress")
  try {
    const { average, total } = await getReputationScore(walletAddress)
    return c.json({ average, total, walletAddress })
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar reputação" },
      400
    )
  }
})

web3Routes.get("/credentials/:walletAddress", async (c) => {
  if (!isWeb3Configured()) {
    return c.json(WEB3_DISABLED, 503)
  }
  const walletAddress = c.req.param("walletAddress")
  try {
    const credentials = await getCredentialsByWallet(walletAddress)
    return c.json({ walletAddress, credentials })
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar credenciais" },
      400
    )
  }
})

web3Routes.get("/credentials/verify/:tokenId", async (c) => {
  if (!isWeb3Configured()) {
    return c.json(WEB3_DISABLED, 503)
  }
  const tokenId = Number(c.req.param("tokenId"))
  if (!Number.isFinite(tokenId) || tokenId < 1) {
    return c.json({ error: "tokenId inválido" }, 400)
  }
  try {
    return c.json(await verifyCredential(tokenId))
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Erro na verificação" },
      400
    )
  }
})

web3Routes.get("/services/:walletAddress", async (c) => {
  if (!isWeb3Configured()) {
    return c.json(WEB3_DISABLED, 503)
  }
  try {
    const services = await getProviderServices(c.req.param("walletAddress"))
    return c.json({ services })
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
      profile,
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
