import { run } from "hardhat"

async function main() {
  const reputation = process.env.REPUTATION_SBT_ADDRESS
  const credentials = process.env.CREDENTIAL_NFT_ADDRESS
  const escrow = process.env.SERVICE_ESCROW_ADDRESS
  const usdc = process.env.USDC_ADDRESS
  const treasury = process.env.TREASURY_ADDRESS ?? "0x0000000000000000000000000000000000000001"
  const feeBps = process.env.PLATFORM_FEE_BPS ?? "500"
  const forwarder = process.env.GELATO_FORWARDER_ADDRESS ?? "0x0000000000000000000000000000000000000000"
  const admin = process.env.ISSUER_ADDRESS ?? "0x0000000000000000000000000000000000000001"

  if (!reputation || !credentials || !escrow || !usdc) {
    throw new Error(
      "Defina REPUTATION_SBT_ADDRESS, CREDENTIAL_NFT_ADDRESS, SERVICE_ESCROW_ADDRESS e USDC_ADDRESS"
    )
  }

  await run("verify:verify", {
    address: reputation,
    constructorArguments: [forwarder],
  })

  await run("verify:verify", {
    address: credentials,
    constructorArguments: [forwarder, admin],
  })

  await run("verify:verify", {
    address: escrow,
    constructorArguments: [usdc, reputation, treasury, feeBps, forwarder],
  })

  console.log("Verificação enviada ao Polygonscan.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
