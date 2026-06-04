import { ethers } from "hardhat"

export const PLATFORM_FEE_BPS = 500n
export const ZERO_FORWARDER = ethers.ZeroAddress

export async function deployNetworkingHub() {
  const [admin, treasury, provider, client, issuer] = await ethers.getSigners()

  const MockUSDC = await ethers.getContractFactory("MockUSDC")
  const usdc = await MockUSDC.deploy()

  const ReputationSBT = await ethers.getContractFactory("ReputationSBT")
  const reputation = await ReputationSBT.deploy(ZERO_FORWARDER)

  const CredentialNFT = await ethers.getContractFactory("CredentialNFT")
  const credentials = await CredentialNFT.deploy(ZERO_FORWARDER, admin.address)

  const ServiceEscrow = await ethers.getContractFactory("ServiceEscrow")
  const escrow = await ServiceEscrow.deploy(
    await usdc.getAddress(),
    await reputation.getAddress(),
    treasury.address,
    PLATFORM_FEE_BPS,
    ZERO_FORWARDER
  )

  await reputation.setEscrowContract(await escrow.getAddress())
  await credentials.grantIssuerRole(issuer.address)

  const mintAmount = ethers.parseUnits("10000", 6)
  await usdc.mint(client.address, mintAmount)
  await usdc.mint(provider.address, mintAmount)

  return { admin, treasury, provider, client, issuer, usdc, reputation, credentials, escrow }
}
