export const ALTO_VALOR_MIN = 500_000

export const CLASSES_EXECUCAO_ALTO_VALOR = [877, 1116, 40] as const

/** Tribunais consultados na coleta (Datajud). */
export const TRIBUNAIS_ALTO_VALOR = [
  { alias: "tjsp", label: "TJSP" },
  { alias: "trf3", label: "TRF3" },
  { alias: "tjrj", label: "TJRJ" },
  { alias: "tjmg", label: "TJMG" },
  { alias: "tjrs", label: "TJRS" },
  { alias: "tjpr", label: "TJPR" },
  { alias: "tjsc", label: "TJSC" },
  { alias: "tjba", label: "TJBA" },
] as const

export const CNAES_RURAL_PREFIXES = [
  "0111",
  "0112",
  "0113",
  "0121",
  "0122",
  "0131",
  "0141",
  "0151",
  "0152",
  "0161",
]
