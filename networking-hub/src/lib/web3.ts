import { createPublicClient, http, type Address, getAddress, isAddress } from "viem"
import { polygon, polygonAmoy } from "viem/chains"
import { getEnv } from "./env.js"
import { credentialNftAbi, reputationSbtAbi, serviceEscrowAbi } from "./abis.js"

export function normalizeWallet(address: string): Address {
  if (!isAddress(address)) {
    throw new Error("Endereço de wallet inválido")
  }
  return getAddress(address)
}

function getChain() {
  const env = getEnv()
  const chainId = env.WEB3_CHAIN_ID ?? 80002
  return chainId === polygon.id ? polygon : polygonAmoy
}

export function getPublicClient() {
  const env = getEnv()
  const chain = getChain()
  const rpcUrl =
    env.WEB3_RPC_URL ??
    (chain.id === polygon.id
      ? "https://polygon-rpc.com"
      : "https://rpc-amoy.polygon.technology")

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  })
}

export function isWeb3Configured(): boolean {
  const env = getEnv()
  return Boolean(env.REPUTATION_SBT_ADDRESS && env.CREDENTIAL_NFT_ADDRESS)
}

export async function getReputationScore(walletAddress: string) {
  const env = getEnv()
  if (!env.REPUTATION_SBT_ADDRESS) {
    return { averageScaled: 0, total: 0, stars: 0, configured: false }
  }

  const client = getPublicClient()
  const address = normalizeWallet(walletAddress)

  const [averageScaled, total] = await client.readContract({
    address: env.REPUTATION_SBT_ADDRESS as Address,
    abi: reputationSbtAbi,
    functionName: "getReputationScore",
    args: [address],
  })

  const stars = total > 0n ? Math.round(Number(averageScaled) / 100) : 0

  return {
    averageScaled: Number(averageScaled),
    total: Number(total),
    stars,
    configured: true,
  }
}

export async function verifyCredential(tokenId: number) {
  const env = getEnv()
  if (!env.CREDENTIAL_NFT_ADDRESS) {
    return { isValid: false, configured: false as const }
  }

  const client = getPublicClient()
  const [isValid, credential] = await client.readContract({
    address: env.CREDENTIAL_NFT_ADDRESS as Address,
    abi: credentialNftAbi,
    functionName: "verifyCredential",
    args: [BigInt(tokenId)],
  })

  return {
    isValid,
    credential: {
      tokenId: Number(credential.tokenId),
      recipient: credential.recipient,
      credentialType: credential.credentialType,
      institution: credential.institution,
      title: credential.title,
      issueDate: Number(credential.issueDate),
      expiryDate: Number(credential.expiryDate),
      metadataURI: credential.metadataURI,
      revoked: credential.revoked,
    },
    configured: true as const,
  }
}

export async function getCredentialsByWallet(walletAddress: string) {
  const env = getEnv()
  if (!env.CREDENTIAL_NFT_ADDRESS) {
    return { credentials: [], configured: false }
  }

  const client = getPublicClient()
  const address = normalizeWallet(walletAddress)
  const rows = await client.readContract({
    address: env.CREDENTIAL_NFT_ADDRESS as Address,
    abi: credentialNftAbi,
    functionName: "getCredentialsByRecipient",
    args: [address],
  })

  const credentials = await Promise.all(
    rows.map(async (row) => {
      const verified = await verifyCredential(Number(row.tokenId))
      return {
        tokenId: Number(row.tokenId),
        credentialType: row.credentialType,
        institution: row.institution,
        title: row.title,
        issueDate: Number(row.issueDate),
        expiryDate: Number(row.expiryDate),
        metadataURI: row.metadataURI,
        revoked: row.revoked,
        isValid: verified.isValid,
      }
    })
  )

  return { credentials, configured: true }
}

export async function getServicesByProvider(walletAddress: string) {
  const env = getEnv()
  if (!env.SERVICE_ESCROW_ADDRESS) {
    return { services: [], configured: false }
  }

  const client = getPublicClient()
  const address = normalizeWallet(walletAddress)
  const rows = await client.readContract({
    address: env.SERVICE_ESCROW_ADDRESS as Address,
    abi: serviceEscrowAbi,
    functionName: "getServicesByProvider",
    args: [address],
  })

  const services = rows.map((s) => ({
    id: Number(s.id),
    provider: s.provider,
    client: s.client,
    amount: s.amount.toString(),
    status: Number(s.status),
    title: s.title,
    description: s.description,
    createdAt: Number(s.createdAt),
    deadline: Number(s.deadline),
    clientApproved: s.clientApproved,
    hasDispute: s.hasDispute,
  }))

  return { services, configured: true }
}
