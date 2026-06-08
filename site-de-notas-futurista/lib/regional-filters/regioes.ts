export type ModuleFilterKey = "licitacoes" | "trabalhista" | "execucoesRurais"

export interface RegionalFilterState {
  regioes: string[]
  cidades: string[]
}

export interface RegiaoCatalog {
  id: string
  nome: string
  uf: string
  cidades: string[]
  comarcas: string[]
  trt: string
  varasTrabalho: string[]
}

export const REGIOES_CATALOG: RegiaoCatalog[] = [
  {
    id: "sorocaba",
    nome: "Região de Sorocaba",
    uf: "SP",
    cidades: ["Sorocaba", "Itu", "Itapetininga", "Botucatu", "Tatuí", "Porto Feliz", "Cerquilho", "Boituva", "Araçoiaba da Serra", "Salto de Pirapora"],
    comarcas: ["Sorocaba", "Itu", "Itapetininga", "Botucatu", "Tatuí", "Porto Feliz", "Cerquilho", "Boituva", "Araçoiaba da Serra", "Salto de Pirapora"],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Sorocaba", "2ª VT de Sorocaba", "VT de Itu", "VT de Itapetininga"],
  },
  {
    id: "presidente_prudente",
    nome: "Região de Presidente Prudente",
    uf: "SP",
    cidades: ["Presidente Prudente", "Marília", "Assis", "Ourinhos", "Tupã", "Adamantina", "Dracena", "Paraguaçu Paulista", "Rancharia", "Santo Anastácio"],
    comarcas: ["Presidente Prudente", "Marília", "Assis", "Ourinhos", "Tupã", "Adamantina", "Dracena", "Paraguaçu Paulista", "Rancharia", "Santo Anastácio"],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Presidente Prudente", "2ª VT de Presidente Prudente", "VT de Marília", "VT de Assis"],
  },
  {
    id: "campinas",
    nome: "Região de Campinas",
    uf: "SP",
    cidades: ["Campinas", "Jundiaí", "Americana", "Piracicaba", "Limeira", "Sumaré", "Indaiatuba", "Valinhos", "Vinhedo", "Hortolândia", "Paulínia", "Santa Bárbara d'Oeste"],
    comarcas: ["Campinas", "Jundiaí", "Americana", "Piracicaba", "Limeira", "Sumaré", "Indaiatuba", "Valinhos", "Vinhedo", "Hortolândia", "Paulínia", "Santa Bárbara d'Oeste"],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Campinas", "2ª VT de Campinas", "VT de Jundiaí"],
  },
  {
    id: "ribeirao_preto",
    nome: "Região de Ribeirão Preto",
    uf: "SP",
    cidades: ["Ribeirão Preto", "Franca", "Barretos", "Araraquara", "São Carlos", "Jaboticabal", "Sertãozinho", "Bebedouro"],
    comarcas: ["Ribeirão Preto", "Franca", "Barretos", "Araraquara", "São Carlos", "Jaboticabal", "Sertãozinho", "Bebedouro"],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Ribeirão Preto", "VT de Franca", "VT de Araraquara"],
  },
  {
    id: "sao_jose_rio_preto",
    nome: "Região de São José do Rio Preto",
    uf: "SP",
    cidades: ["São José do Rio Preto", "Catanduva", "Votuporanga", "Fernandópolis", "Araçatuba", "Birigui", "Penápolis"],
    comarcas: ["São José do Rio Preto", "Catanduva", "Votuporanga", "Fernandópolis", "Araçatuba", "Birigui", "Penápolis"],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de São José do Rio Preto", "VT de Araçatuba", "VT de Catanduva"],
  },
]

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

export function expandFilterCities(filter: RegionalFilterState): Set<string> {
  const set = new Set<string>()
  for (const id of filter.regioes) {
    const reg = REGIOES_CATALOG.find((r) => r.id === id)
    reg?.cidades.forEach((c) => set.add(normalize(c)))
  }
  filter.cidades.forEach((c) => set.add(normalize(c)))
  return set
}

export function matchesRegionalFilter(
  locations: Array<string | null | undefined>,
  filter: RegionalFilterState,
): boolean {
  const allowed = expandFilterCities(filter)
  if (allowed.size === 0) return true
  const hay = locations.filter(Boolean).map((l) => normalize(String(l)))
  for (const loc of hay) {
    for (const city of allowed) {
      if (loc.includes(city) || city.includes(loc)) return true
    }
  }
  return false
}

export function citiesForRegioes(regiaoIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of regiaoIds) {
    REGIOES_CATALOG.find((r) => r.id === id)?.cidades.forEach((c) => set.add(c))
  }
  return [...set].sort()
}
