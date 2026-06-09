export const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"

/** API Key pública CNJ (documentação Datajud). */
export const DATAJUD_PUBLIC_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

/** Proxies server-side (CF Worker ou Firebase Function). */
export const DATAJUD_PROXY_URLS = [
  process.env.NEXT_PUBLIC_DATAJUD_PROXY_URL,
  "https://datajud-proxy.contabilidade-app.workers.dev",
  "https://us-central1-contabilidade-ebed6.cloudfunctions.net/datajudSearch",
].filter((u): u is string => Boolean(u))

export const DEFAULT_TRTS = [1, 2, 3, 15] as const

export const TRIBUNAIS_EXECUCAO = [
  { alias: "tjsp", label: "TJSP" },
  { alias: "trf3", label: "TRF3" },
] as const
