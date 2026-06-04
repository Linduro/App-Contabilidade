export function buildProfileEmbeddingText(profile: {
  areaAtuacao: string[]
  cargoAtual: string | null
  empresa: string | null
  expertises: string[]
  oQueOfeco: string | null
  oQueBusco: string | null
}): string {
  const areas = profile.areaAtuacao.length > 0 ? profile.areaAtuacao.join(", ") : "não informada"

  return [
    `Profissional de ${areas}.`,
    `Cargo: ${profile.cargoAtual ?? "não informado"} em ${profile.empresa ?? "não informada"}.`,
    `Expertises: ${profile.expertises.length > 0 ? profile.expertises.join(", ") : "não informadas"}.`,
    `Oferece: ${profile.oQueOfeco ?? "não informado"}.`,
    `Busca: ${profile.oQueBusco ?? "não informado"}.`,
  ].join("\n")
}
