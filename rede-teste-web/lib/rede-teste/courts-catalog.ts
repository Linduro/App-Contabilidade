/** Catálogo de tribunais brasileiros para tag de jurisdição no Rede Teste. */
export type CourtSeed = {
  code: string;
  name: string;
  jurisdiction: string;
  state: string | null;
};

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

function superiorCourts(): CourtSeed[] {
  return [
    { code: "STF", name: "Supremo Tribunal Federal", jurisdiction: "superior", state: null },
    { code: "STJ", name: "Superior Tribunal de Justiça", jurisdiction: "superior", state: null },
    { code: "TST", name: "Tribunal Superior do Trabalho", jurisdiction: "superior", state: null },
    { code: "TSE", name: "Tribunal Superior Eleitoral", jurisdiction: "superior", state: null },
    { code: "STM", name: "Superior Tribunal Militar", jurisdiction: "superior", state: null },
  ];
}

function trfCourts(): CourtSeed[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    code: `TRF${n}`,
    name: `Tribunal Regional Federal da ${n}ª Região`,
    jurisdiction: "federal",
    state: null,
  }));
}

function trtCourts(): CourtSeed[] {
  return Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    return {
      code: `TRT${n}`,
      name: `Tribunal Regional do Trabalho da ${n}ª Região`,
      jurisdiction: "trabalhista",
      state: null,
    };
  });
}

function tjCourts(): CourtSeed[] {
  return UFS.map((uf) => ({
    code: `TJ${uf}`,
    name: `Tribunal de Justiça ${UF_NAMES[uf] ? `do ${UF_NAMES[uf]}` : uf}`,
    jurisdiction: "estadual",
    state: uf,
  }));
}

function treCourts(): CourtSeed[] {
  return UFS.map((uf) => ({
    code: `TRE-${uf}`,
    name: `Tribunal Regional Eleitoral ${UF_NAMES[uf] ? `de ${UF_NAMES[uf]}` : uf}`,
    jurisdiction: "eleitoral",
    state: uf,
  }));
}

function tjmCourts(): CourtSeed[] {
  return [
    { code: "TJM-SP", name: "Tribunal de Justiça Militar de São Paulo", jurisdiction: "militar", state: "SP" },
    { code: "TJM-MG", name: "Tribunal de Justiça Militar de Minas Gerais", jurisdiction: "militar", state: "MG" },
    { code: "TJM-RS", name: "Tribunal de Justiça Militar do Rio Grande do Sul", jurisdiction: "militar", state: "RS" },
  ];
}

export const JURIDIQUES_COURTS_CATALOG: CourtSeed[] = [
  ...superiorCourts(),
  ...trfCourts(),
  ...trtCourts(),
  ...treCourts(),
  ...tjCourts(),
  ...tjmCourts(),
  { code: "INSS", name: "INSS — Esfera Administrativa", jurisdiction: "administrativo", state: null },
];
