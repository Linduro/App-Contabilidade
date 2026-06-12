/**
 * Gera deployments/amoy.json a partir do deploy Ignition em polygon_amoy.
 * Uso: npx hardhat run scripts/export-amoy-json.ts
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function findDeployedAddresses(): Record<string, string> | null {
  const deploymentsDir = path.join(root, "ignition", "deployments")
  if (!fs.existsSync(deploymentsDir)) return null

  const chainDir = path.join(deploymentsDir, "chain-80002")
  const deployedFile = path.join(chainDir, "deployed_addresses.json")
  if (fs.existsSync(deployedFile)) {
    return JSON.parse(fs.readFileSync(deployedFile, "utf8")) as Record<string, string>
  }

  for (const entry of fs.readdirSync(deploymentsDir)) {
    const candidate = path.join(deploymentsDir, entry, "deployed_addresses.json")
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf8")) as Record<string, string>
    }
  }
  return null
}

function main() {
  const deployed = findDeployedAddresses()
  if (!deployed) {
    console.error(
      "Nenhum deployed_addresses.json encontrado. Rode o deploy Amoy primeiro:\n" +
        "  npx hardhat ignition deploy ignition/modules/NetworkingHub.ts --network polygon_amoy"
    )
    process.exit(1)
  }

  const outDir = path.join(root, "deployments")
  fs.mkdirSync(outDir, { recursive: true })

  const officialUsdc =
    process.env.USDC_ADDRESS_AMOY ?? "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"

  const payload = {
    network: "polygon_amoy",
    chainId: 80002,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockUSDC:
        deployed["NetworkingHub#USDC"] ??
        deployed["NetworkingHub#MockUSDC"] ??
        deployed["NetworkingHubAmoy#usdcAddress"] ??
        officialUsdc,
      ReputationSBT:
        deployed["NetworkingHub#ReputationSBT"] ??
        deployed["NetworkingHubAmoy#ReputationSBT"] ??
        "",
      CredentialNFT:
        deployed["NetworkingHub#CredentialNFT"] ??
        deployed["NetworkingHubAmoy#CredentialNFT"] ??
        "",
      ServiceEscrow:
        deployed["NetworkingHub#ServiceEscrow"] ??
        deployed["NetworkingHubAmoy#ServiceEscrow"] ??
        "",
    },
  }

  const outPath = path.join(outDir, "amoy.json")
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
  console.log("Salvo:", outPath)
  console.log(JSON.stringify(payload, null, 2))
}

main()
