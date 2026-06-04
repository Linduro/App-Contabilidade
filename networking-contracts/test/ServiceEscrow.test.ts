import { expect } from "chai"
import { ethers } from "hardhat"
import { deployNetworkingHub } from "./helpers/deploy"

describe("ServiceEscrow", () => {
  const amount = ethers.parseUnits("1000", 6)

  async function createOpenService(escrow: Awaited<ReturnType<typeof deployNetworkingHub>>["escrow"], provider: { getAddress: () => Promise<string> }) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7)
    return escrow.connect(provider).createService("Consultoria IFRS", "Revisão de demonstrações", amount, deadline)
  }

  it("cria serviço com parâmetros válidos", async () => {
    const { escrow, provider } = await deployNetworkingHub()
    const tx = await createOpenService(escrow, provider)
    await expect(tx).to.emit(escrow, "ServiceCreated").withArgs(1, await provider.getAddress(), "Consultoria IFRS", amount)

    const s = await escrow.services(1)
    expect(s.status).to.equal(0) // Open
    expect(s.amount).to.equal(amount)
  })

  it("contrata serviço e mantém USDC em escrow", async () => {
    const { escrow, provider, client, usdc, treasury } = await deployNetworkingHub()
    await createOpenService(escrow, provider)

    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await expect(escrow.connect(client).hireService(1)).to.emit(escrow, "ServiceHired")

    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(amount)
    expect(await usdc.balanceOf(treasury.address)).to.equal(0)

    const s = await escrow.services(1)
    expect(s.status).to.equal(1) // InProgress
  })

  it("marca entregue, aprova e distribui 95% provider / 5% treasury", async () => {
    const { escrow, provider, client, usdc, treasury } = await deployNetworkingHub()
    const providerAddr = await provider.getAddress()
    const providerBefore = await usdc.balanceOf(providerAddr)
    const treasuryBefore = await usdc.balanceOf(treasury.address)

    await createOpenService(escrow, provider)
    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await escrow.connect(client).hireService(1)
    await escrow.connect(provider).markDelivered(1)

    await expect(escrow.connect(client).approveDelivery(1, 5, "Excelente trabalho")).to.emit(
      escrow,
      "ServiceCompleted"
    )

    const fee = (amount * 500n) / 10_000n
    const providerShare = amount - fee

    expect(await usdc.balanceOf(providerAddr)).to.equal(providerBefore + providerShare)
    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + fee)
    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0)

    const s = await escrow.services(1)
    expect(s.status).to.equal(3) // Completed
  })

  it("resolve disputa a favor do provider", async () => {
    const { escrow, provider, client, usdc, treasury, admin } = await deployNetworkingHub()
    const providerAddr = await provider.getAddress()
    const providerBefore = await usdc.balanceOf(providerAddr)
    const treasuryBefore = await usdc.balanceOf(treasury.address)

    await createOpenService(escrow, provider)
    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await escrow.connect(client).hireService(1)
    await escrow.connect(provider).markDelivered(1)
    await escrow.connect(client).openDispute(1)

    await escrow.connect(admin).resolveDispute(1, true)

    const fee = (amount * 500n) / 10_000n
    expect(await usdc.balanceOf(providerAddr)).to.equal(providerBefore + amount - fee)
    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + fee)
  })

  it("resolve disputa a favor do cliente", async () => {
    const { escrow, provider, client, usdc, admin } = await deployNetworkingHub()
    await createOpenService(escrow, provider)
    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await escrow.connect(client).hireService(1)
    await escrow.connect(provider).markDelivered(1)
    await escrow.connect(provider).openDispute(1)

    const clientBefore = await usdc.balanceOf(await client.getAddress())
    await escrow.connect(admin).resolveDispute(1, false)

    expect(await usdc.balanceOf(await client.getAddress())).to.equal(clientBefore + amount)
  })

  it("cancela serviço antes de InProgress", async () => {
    const { escrow, provider } = await deployNetworkingHub()
    await createOpenService(escrow, provider)
    await expect(escrow.connect(provider).cancelService(1)).to.emit(escrow, "ServiceCancelled")
    expect((await escrow.services(1)).status).to.equal(5) // Cancelled
  })

  it("reverte ações não autorizadas", async () => {
    const { escrow, provider, client, usdc } = await deployNetworkingHub()
    await createOpenService(escrow, provider)

    await expect(escrow.connect(client).markDelivered(1)).to.be.revertedWithCustomError(
      escrow,
      "NotProvider"
    )

    await usdc.connect(client).approve(await escrow.getAddress(), amount)
    await escrow.connect(client).hireService(1)

    await expect(escrow.connect(provider).approveDelivery(1, 5, "x")).to.be.revertedWithCustomError(
      escrow,
      "NotClient"
    )

    await expect(escrow.connect(client).cancelService(1)).to.be.revertedWithCustomError(
      escrow,
      "NotProvider"
    )
  })
})
