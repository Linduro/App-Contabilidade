import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { profiles } from "../../db/schema.js"
import {
  getCredentialsByWallet,
  getReputationScore,
  getServicesByProvider,
  normalizeWallet,
  verifyCredential,
} from "../../lib/web3.js"
import { getProfileByUserId, ProfileServiceError } from "../profile/profile.service.js"
import type { LinkWalletInput } from "./web3.schema.js"

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

  return updated
}

export {
  getReputationScore,
  getCredentialsByWallet,
  getServicesByProvider,
  verifyCredential,
}
