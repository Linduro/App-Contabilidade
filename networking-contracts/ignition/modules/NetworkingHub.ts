import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const ZERO_FORWARDER = "0x0000000000000000000000000000000000000000"

const NetworkingHubModule = buildModule("NetworkingHub", (m) => {
  const deployer = m.getAccount(0)
  const treasury = m.getParameter("treasury", "0x0556F4312be4481437941d8897D50Fde1a9AB606")
  const platformFeeBps = m.getParameter("platformFeeBps", 500)
  const forwarder = m.getParameter("gelatoForwarder", ZERO_FORWARDER)

  const usdc = m.contract("MockUSDC", [], { id: "USDC" })
  const reputation = m.contract("ReputationSBT", [forwarder], { id: "ReputationSBT" })
  const credentials = m.contract("CredentialNFT", [forwarder, deployer], {
    id: "CredentialNFT",
  })

  const escrow = m.contract(
    "ServiceEscrow",
    [usdc, reputation, treasury, platformFeeBps, forwarder],
    { id: "ServiceEscrow" }
  )

  m.call(reputation, "setEscrowContract", [escrow], { id: "LinkEscrowToReputation" })
  m.call(credentials, "grantIssuerRole", [deployer], { id: "GrantIssuerRole" })

  return { usdc, reputation, credentials, escrow }
})

export default NetworkingHubModule
