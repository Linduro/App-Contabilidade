export const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"



/** API Key pública CNJ (documentação Datajud). */

export const DATAJUD_PUBLIC_API_KEY =

  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="



/** Proxy Cloudflare Worker — único endpoint usado no browser (evita CORS). */

export const DATAJUD_PROXY_URL =

  process.env.NEXT_PUBLIC_DATAJUD_PROXY_URL ||

  "https://datajud-proxy.contabilidade-app.workers.dev"



export const DEFAULT_TRTS = [1, 2, 3, 15] as const



export const TRIBUNAIS_EXECUCAO = [

  { alias: "tjsp", label: "TJSP" },

  { alias: "trf3", label: "TRF3" },

] as const

