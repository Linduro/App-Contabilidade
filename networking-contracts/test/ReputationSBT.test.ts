import { expect } from "chai"
import { ethers } from "hardhat"
import { deployNetworkingHub } from "./helpers/deploy"

describe("ReputationSBT", () => {
  const amount = ethers.parseUnits("500", 6)

  async function completeService(
    hub: Awaited<ReturnType<typeof deployNetworkingHub>>
  ) {
    const { escrow, provider, client, usdc } = hub
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7)
    await escrow.connect(provider).createService("Mentoria", "1h", amount, deadline)
    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await escrow.connect(client).hireService(1)
    await escrow.connect(provider).markDelivered(1)
    await escrow.connect(client).approveDelivery(1, 4, "Ótimo")
  }

  it("minta SBT ao completar serviço", async () => {
    const hub = await deployNetworkingHub()
    await completeService(hub)

    expect(await hub.reputation.ownerOf(1)).to.equal(await hub.provider.getAddress())
    const [avg, total] = await hub.reputation.getReputationScore(await hub.provider.getAddress())
    expect(total).to.equal(1)
    expect(avg).to.equal(400) // 4 * 100
  })

  it("bloqueia transferência", async () => {
    const hub = await deployNetworkingHub()
    await completeService(hub)

    const providerAddr = await hub.provider.getAddress()
    const [, , stranger] = await ethers.getSigners()

    await expect(
      hub.reputation.connect(hub.provider).transferFrom(providerAddr, stranger.address, 1)
    ).to.be.revertedWithCustomError(hub.reputation, "SoulboundTransfer")
  })

  it("calcula média correta com múltiplos SBTs", async () => {
    const hub = await deployNetworkingHub()
    await completeService(hub)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7)
    await hub.escrow.connect(hub.provider).createService("B", "desc", amount, deadline)
    await hub.usdc.connect(hub.client).approve(await hub.escrow.getAddress(), amount)
    await hub.escrow.connect(hub.client).hireService(2)
    await hub.escrow.connect(hub.provider).markDelivered(2)
    await hub.escrow.connect(hub.client).approveDelivery(2, 2, "ok")

    const [avg, total] = await hub.reputation.getReputationScore(await hub.provider.getAddress())
    expect(total).to.equal(2)
    expect(avg).to.equal(300) // (4+2)/2 * 100
  })

  it("permite burn pelo próprio dono", async () => {
    const hub = await deployNetworkingHub()
    await completeService(hub)

    await hub.reputation.connect(hub.provider).burnReputation(1)
    await expect(hub.reputation.ownerOf(1)).to.be.reverted
  })

  it("reverte mint fora do escrow", async () => {
    const hub = await deployNetworkingHub()
    await expect(
      hub.reputation
        .connect(hub.client)
        .issueReputation(await hub.provider.getAddress(), await hub.client.getAddress(), 5, "x", 1)
    ).to.be.revertedWithCustomError(hub.reputation, "OnlyEscrow")
  })
})
