import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const ZERO_FORWARDER = "0x0000000000000000000000000000000000000000"

/** Deploy na Polygon Amoy usando USDC oficial (sem MockUSDC). */
const NetworkingHubAmoyModule = buildModule("NetworkingHubAmoy", (m) => {
  const usdcAddress = m.getParameter(
    "usdcAddress",
    "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
  )
  const deployer = m.getAccount(0)
  const treasury = m.getParameter("treasury", "0x0556F4312be4481437941d8897D50Fde1a9AB606")
  const platformFeeBps = m.getParameter("platformFeeBps", 500)
  const forwarder = m.getParameter("gelatoForwarder", ZERO_FORWARDER)

  const reputation = m.contract("ReputationSBT", [forwarder], { id: "ReputationSBT" })
  const credentials = m.contract("CredentialNFT", [forwarder, deployer], { id: "CredentialNFT" })

  const escrow = m.contract(
    "ServiceEscrow",
    [usdcAddress, reputation, treasury, platformFeeBps, forwarder],
    { id: "ServiceEscrow" }
  )

  m.call(reputation, "setEscrowContract", [escrow], { id: "LinkEscrowToReputation" })
  m.call(credentials, "grantIssuerRole", [deployer], { id: "GrantIssuerRole" })

  return { usdcAddress, reputation, credentials, escrow }
})

export default NetworkingHubAmoyModule
