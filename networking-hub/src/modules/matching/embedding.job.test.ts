import { describe, expect, it } from "vitest"
import { buildProfileEmbeddingText } from "./embedding-text.js"

describe("buildProfileEmbeddingText", () => {
  it("monta texto com campos do perfil", () => {
    const text = buildProfileEmbeddingText({
      areaAtuacao: ["Auditoria", "ESG"],
      cargoAtual: "Analista",
      empresa: "ACME",
      expertises: ["IFRS", "Auditoria"],
      oQueOfeco: "Mentoria em carreira",
      oQueBusco: "Parceiros para projetos ESG",
    })

    expect(text).toContain("Auditoria")
    expect(text).toContain("IFRS")
    expect(text).toContain("Mentoria em carreira")
    expect(text).toContain("Parceiros para projetos ESG")
  })
})
