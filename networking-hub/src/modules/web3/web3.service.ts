import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { profiles } from "../../db/schema.js"
import {
  getReputationScore,
  getCredentialsByWallet,
  getProviderServices,
  verifyCredential,
  normalizeWallet,
  isWeb3Configured,
  isWeb3Enabled,
} from "../../lib/web3.js"
import { getProfileByUserId, ProfileServiceError } from "../profile/profile.service.js"
import type { LinkWalletInput } from "./web3.schema.js"

export {
  getReputationScore,
  getCredentialsByWallet,
  getProviderServices,
  verifyCredential,
  isWeb3Configured,
  isWeb3Enabled,
}

export async function linkWalletToProfile(userId: string, input: LinkWalletInput) {
  const profile = await getProfileByUserId(userId)
  if (!profile) {
    throw new ProfileServiceError("PROFILE_NOT_FOUND", "Perfil não encontrado", 404)
  }

  const wallet = normalizeWallet(input.walletAddress)

  const [updated] = await db
    .update(profiles)
    .set({ walletAddress: wallet, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id))
    .returning()

  if (!updated) {
    throw new Error("Falha ao vincular wallet")
  }

  const { embedding: _e, userId: _u, ...publicProfile } = updated
  return publicProfile
}
