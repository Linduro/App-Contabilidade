import { createPublicClient, http, type Address, getAddress, isAddress, parseAbi } from "viem"
import { polygonAmoy } from "viem/chains"
import { getEnv, isWeb3Enabled as envWeb3Enabled } from "./env.js"
import { getContractAddresses } from "./contract-addresses.js"
import serviceEscrowAbi from "./abis/ServiceEscrow.abi.json" with { type: "json" }
import reputationSbtAbi from "./abis/ReputationSBT.abi.json" with { type: "json" }
import credentialNftAbi from "./abis/CredentialNFT.abi.json" with { type: "json" }

type OnChainCredential = {
  tokenId: bigint
  recipient: Address
  credentialType: string
  institution: string
  title: string
  issueDate: bigint
  expiryDate: bigint
  metadataURI: string
  revoked: boolean
}

const ALCHEMY_URL =
  process.env.WEB3_RPC_URL ??
  `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ""}`

export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(getEnv().WEB3_RPC_URL ?? ALCHEMY_URL),
})

export function normalizeWallet(address: string): Address {
  if (!isAddress(address)) {
    throw new Error("Endereço de wallet inválido")
  }
  return getAddress(address)
}

function requireAddress(addr: string, label: string): Address {
  if (!isWeb3Enabled()) {
    throw new Error("Integração on-chain desativada (WEB3_ENABLED=false)")
  }
  if (!addr || !isAddress(addr)) {
    throw new Error(`${label} não configurado. Defina endereços em deployments/amoy.json`)
  }
  return getAddress(addr)
}

/** Lê dados on-chain só quando WEB3_ENABLED=true e contratos estão completos. */
export function isWeb3Enabled(): boolean {
  return envWeb3Enabled()
}

export function isWeb3Configured(): boolean {
  if (!isWeb3Enabled()) return false
  const a = getContractAddresses()
  return Boolean(a.reputationSbt && a.credentialNft && a.serviceEscrow)
}

export async function getReputationScore(
  walletAddress: string
): Promise<{ average: number; total: number }> {
  const { reputationSbt } = getContractAddresses()
  const address = normalizeWallet(walletAddress)

  const [averageScaled, total] = (await publicClient.readContract({
    address: requireAddress(reputationSbt, "ReputationSBT"),
    abi: reputationSbtAbi,
    functionName: "getReputationScore",
    args: [address],
  })) as readonly [bigint, bigint]

  return {
    average: Number(total) > 0 ? Number(averageScaled) / 100 : 0,
    total: Number(total),
  }
}

export async function verifyCredential(tokenId: number) {
  const { credentialNft } = getContractAddresses()

  const [isValid, credential] = (await publicClient.readContract({
    address: requireAddress(credentialNft, "CredentialNFT"),
    abi: credentialNftAbi,
    functionName: "verifyCredential",
    args: [BigInt(tokenId)],
  })) as readonly [boolean, OnChainCredential]

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
  }
}

export async function getCredentialsByWallet(walletAddress: string) {
  const { credentialNft } = getContractAddresses()
  const address = normalizeWallet(walletAddress)

  const rows = (await publicClient.readContract({
    address: requireAddress(credentialNft, "CredentialNFT"),
    abi: credentialNftAbi,
    functionName: "getCredentialsByRecipient",
    args: [address],
  })) as readonly OnChainCredential[]

  const credentials = []
  for (const row of rows) {
    const verified = await verifyCredential(Number(row.tokenId))
    if (verified.isValid) {
      credentials.push({
        ...verified.credential,
        polygonscanUrl: `https://amoy.polygonscan.com/nft/${credentialNft}/${row.tokenId}`,
      })
    }
  }

  return credentials
}

export async function getProviderServices(walletAddress: string) {
  const { serviceEscrow } = getContractAddresses()
  const provider = normalizeWallet(walletAddress)
  const escrowAddress = requireAddress(serviceEscrow, "ServiceEscrow")

  const logs = await publicClient.getContractEvents({
    address: escrowAddress,
    abi: parseAbi([
      "event ServiceCreated(uint256 indexed serviceId, address indexed provider, string title, uint256 amount)",
    ]),
    eventName: "ServiceCreated",
    args: { provider },
    fromBlock: 0n,
    toBlock: "latest",
  })

  return logs.map((log) => ({
    serviceId: Number(log.args.serviceId),
    provider: log.args.provider,
    title: log.args.title,
    amount: log.args.amount?.toString(),
    transactionHash: log.transactionHash,
    blockNumber: Number(log.blockNumber),
  }))
}

/** Alias legado */
export async function getServicesByProvider(walletAddress: string) {
  const events = await getProviderServices(walletAddress)
  return { services: events, configured: true }
}
