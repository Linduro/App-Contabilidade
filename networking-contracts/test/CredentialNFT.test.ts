import { expect } from "chai"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { deployNetworkingHub } from "./helpers/deploy"

describe("CredentialNFT", () => {
  const metadata = "ipfs://QmExample"

  it("emite credencial com ISSUER_ROLE", async () => {
    const { credentials, issuer, client } = await deployNetworkingHub()

    await expect(
      credentials
        .connect(issuer)
        .issueCredential(
          await client.getAddress(),
          "MBA",
          "FIPECAFI",
          "MBA em Controladoria",
          Math.floor(Date.now() / 1000),
          0,
          metadata
        )
    ).to.emit(credentials, "CredentialIssued")

    const [valid] = await credentials.verifyCredential(1)
    expect(valid).to.equal(true)
  })

  it("reverte emissão sem ISSUER_ROLE", async () => {
    const { credentials, client, provider } = await deployNetworkingHub()

    await expect(
      credentials
        .connect(provider)
        .issueCredential(
          await client.getAddress(),
          "Cert",
          "X",
          "Título",
          1,
          0,
          metadata
        )
    ).to.be.reverted
  })

  it("revoga e verifica como inválida", async () => {
    const { credentials, issuer, client } = await deployNetworkingHub()

    await credentials
      .connect(issuer)
      .issueCredential(await client.getAddress(), "Curso", "CFC", "Cert", 1, 0, metadata)

    await credentials.connect(issuer).revokeCredential(1)
    const [valid] = await credentials.verifyCredential(1)
    expect(valid).to.equal(false)
  })

  it("credencial expirada retorna isValid = false", async () => {
    const { credentials, issuer, client } = await deployNetworkingHub()
    const now = await time.latest()
    const expiry = now + 3600

    await credentials
      .connect(issuer)
      .issueCredential(await client.getAddress(), "Curso", "FIPECAFI", "Short", now, expiry, metadata)

    await time.increaseTo(expiry + 1)
    const [valid] = await credentials.verifyCredential(1)
    expect(valid).to.equal(false)
  })
})
