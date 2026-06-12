import fs from "node:fs"
import path from "node:path"
import { getEnv } from "./env.js"

export interface AmoyDeployment {
  network: string
  chainId: number
  status?: string
  deployedAt: string | null
  contracts: {
    MockUSDC: string
    ReputationSBT: string
    CredentialNFT: string
    ServiceEscrow: string
  }
}

function readAmoyJson(): AmoyDeployment | null {
  const candidates = [
    path.join(process.cwd(), "../networking-contracts/deployments/amoy.json"),
    path.join(process.cwd(), "deployments/amoy.json"),
  ]

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8")) as AmoyDeployment
    }
  }
  return null
}

export function getContractAddresses() {
  const env = getEnv()
  const file = readAmoyJson()
  const useFile = file && file.status !== "aborted"

  return {
    mockUsdc:
      env.MOCK_USDC_ADDRESS ??
      env.USDC_ADDRESS_AMOY ??
      (useFile ? file.contracts.MockUSDC : "") ??
      "",
    reputationSbt:
      env.REPUTATION_SBT_ADDRESS ?? (useFile ? file.contracts.ReputationSBT : "") ?? "",
    credentialNft:
      env.CREDENTIAL_NFT_ADDRESS ?? (useFile ? file.contracts.CredentialNFT : "") ?? "",
    serviceEscrow:
      env.SERVICE_ESCROW_ADDRESS ?? (useFile ? file.contracts.ServiceEscrow : "") ?? "",
  }
}
