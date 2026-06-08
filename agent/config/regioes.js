/** Catálogo regional — usado pelo worker e espelhado no dashboard (regioes.ts). */
const REGIOES = [
  {
    id: "sorocaba",
    nome: "Região de Sorocaba",
    uf: "SP",
    cidades: [
      "Sorocaba",
      "Itu",
      "Itapetininga",
      "Botucatu",
      "Tatuí",
      "Porto Feliz",
      "Cerquilho",
      "Boituva",
      "Araçoiaba da Serra",
      "Salto de Pirapora",
    ],
    comarcas: [
      "Sorocaba",
      "Itu",
      "Itapetininga",
      "Botucatu",
      "Tatuí",
      "Porto Feliz",
      "Cerquilho",
      "Boituva",
      "Araçoiaba da Serra",
      "Salto de Pirapora",
    ],
    trt: "TRT15",
    varasTrabalho: [
      "1ª VT de Sorocaba",
      "2ª VT de Sorocaba",
      "VT de Itu",
      "VT de Itapetininga",
    ],
  },
  {
    id: "presidente_prudente",
    nome: "Região de Presidente Prudente",
    uf: "SP",
    cidades: [
      "Presidente Prudente",
      "Marília",
      "Assis",
      "Ourinhos",
      "Tupã",
      "Adamantina",
      "Dracena",
      "Paraguaçu Paulista",
      "Rancharia",
      "Santo Anastácio",
    ],
    comarcas: [
      "Presidente Prudente",
      "Marília",
      "Assis",
      "Ourinhos",
      "Tupã",
      "Adamantina",
      "Dracena",
      "Paraguaçu Paulista",
      "Rancharia",
      "Santo Anastácio",
    ],
    trt: "TRT15",
    varasTrabalho: [
      "1ª VT de Presidente Prudente",
      "2ª VT de Presidente Prudente",
      "VT de Marília",
      "VT de Assis",
    ],
  },
  {
    id: "campinas",
    nome: "Região de Campinas",
    uf: "SP",
    cidades: [
      "Campinas",
      "Jundiaí",
      "Americana",
      "Piracicaba",
      "Limeira",
      "Sumaré",
      "Indaiatuba",
      "Valinhos",
      "Vinhedo",
      "Hortolândia",
      "Paulínia",
      "Santa Bárbara d'Oeste",
    ],
    comarcas: [
      "Campinas",
      "Jundiaí",
      "Americana",
      "Piracicaba",
      "Limeira",
      "Sumaré",
      "Indaiatuba",
      "Valinhos",
      "Vinhedo",
      "Hortolândia",
      "Paulínia",
      "Santa Bárbara d'Oeste",
    ],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Campinas", "2ª VT de Campinas", "VT de Jundiaí"],
  },
  {
    id: "ribeirao_preto",
    nome: "Região de Ribeirão Preto",
    uf: "SP",
    cidades: [
      "Ribeirão Preto",
      "Franca",
      "Barretos",
      "Araraquara",
      "São Carlos",
      "Jaboticabal",
      "Sertãozinho",
      "Bebedouro",
    ],
    comarcas: [
      "Ribeirão Preto",
      "Franca",
      "Barretos",
      "Araraquara",
      "São Carlos",
      "Jaboticabal",
      "Sertãozinho",
      "Bebedouro",
    ],
    trt: "TRT15",
    varasTrabalho: ["1ª VT de Ribeirão Preto", "VT de Franca", "VT de Araraquara"],
  },
  {
    id: "sao_jose_rio_preto",
    nome: "Região de São José do Rio Preto",
    uf: "SP",
    cidades: [
      "São José do Rio Preto",
      "Catanduva",
      "Votuporanga",
      "Fernandópolis",
      "Araçatuba",
      "Birigui",
      "Penápolis",
    ],
    comarcas: [
      "São José do Rio Preto",
      "Catanduva",
      "Votuporanga",
      "Fernandópolis",
      "Araçatuba",
      "Birigui",
      "Penápolis",
    ],
    trt: "TRT15",
    varasTrabalho: [
      "1ª VT de São José do Rio Preto",
      "VT de Araçatuba",
      "VT de Catanduva",
    ],
  },
]

function normalizeLocation(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getRegiaoById(id) {
  return REGIOES.find((r) => r.id === id) || null
}

function expandFilterCities(filter) {
  const set = new Set()
  if (!filter) return set

  for (const regiaoId of filter.regioes || []) {
    const reg = getRegiaoById(regiaoId)
    if (reg) {
      for (const c of reg.cidades) set.add(normalizeLocation(c))
    }
  }
  for (const cidade of filter.cidades || []) {
    set.add(normalizeLocation(cidade))
  }
  return set
}

/** Verifica se registro passa no filtro regional do módulo. Vazio = nacional. */
function matchesRegionalFilter(record, filter) {
  const allowed = expandFilterCities(filter)
  if (allowed.size === 0) return true

  const haystack = [
    record.municipio,
    record.comarca,
    record.cidade,
    record.municipio_imovel,
    record.vara,
    record.uf,
  ]
    .filter(Boolean)
    .map(normalizeLocation)

  for (const loc of haystack) {
    for (const city of allowed) {
      if (loc.includes(city) || city.includes(loc)) return true
    }
  }
  return false
}

module.exports = {
  REGIOES,
  normalizeLocation,
  getRegiaoById,
  expandFilterCities,
  matchesRegionalFilter,
}
