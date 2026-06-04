import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const ZERO_FORWARDER = "0x0000000000000000000000000000000000000000"

/**
 * Deploy ordem: MockUSDC → ReputationSBT → CredentialNFT → ServiceEscrow → link escrow.
 * Em Amoy com USDC oficial, use parâmetro usdcAddress e módulo NetworkingHubProduction (futuro).
 */
const NetworkingHubModule = buildModule("NetworkingHub", (m) => {
  const treasury = m.getParameter("treasury", "0x0000000000000000000000000000000000000001")
  const platformFeeBps = m.getParameter("platformFeeBps", 500)
  const admin = m.getParameter("admin", "0x0000000000000000000000000000000000000001")
  const issuer = m.getParameter("issuer", "0x0000000000000000000000000000000000000001")
  const forwarder = m.getParameter("gelatoForwarder", ZERO_FORWARDER)

  const usdc = m.contract("MockUSDC", [], { id: "USDC" })
  const reputation = m.contract("ReputationSBT", [forwarder], { id: "ReputationSBT" })
  const credentials = m.contract("CredentialNFT", [forwarder, admin], { id: "CredentialNFT" })

  const escrow = m.contract(
    "ServiceEscrow",
    [usdc, reputation, treasury, platformFeeBps, forwarder],
    { id: "ServiceEscrow" }
  )

  m.call(reputation, "setEscrowContract", [escrow], { id: "LinkEscrowToReputation" })
  m.call(credentials, "grantIssuerRole", [issuer], { id: "GrantIssuerRole" })

  return { usdc, reputation, credentials, escrow }
})

export default NetworkingHubModule
