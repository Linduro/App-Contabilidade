import { extractPartes, hasPartesMetadata } from "@/lib/datajud/metadata"

/** true = com advogado no polo passivo; false = sem; null = capa sem partes (desconhecido). */
export type AdvogadoStatus = boolean | null

function isPoloPassivo(parte: Record<string, unknown>) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function parteTemAdvogado(parte: Record<string, unknown>) {
  const reps = (parte.advogados || parte.representantes || []) as unknown[]
  return Array.isArray(reps) && reps.length > 0
}

export function detectAdvogadoPassivo(source: Record<string, unknown>): AdvogadoStatus {
  if (!hasPartesMetadata(source)) return null
  if (Array.isArray(source.advogados) && source.advogados.length) return true

  const partes = extractPartes(source)
  const passivos = partes.filter(isPoloPassivo)
  const alvo = passivos.length ? passivos : partes

  for (const parte of alvo) {
    if (parteTemAdvogado(parte)) return true
  }
  return false
}

export function detectIndicioRural(texto: string) {
  const t = texto.toLowerCase()
  return /produtor rural|agropecu|fazenda|sitio|s[ií]tio|ch[aá]cara|nirf|car\b|lavoura|pecu[aá]ria|agr[ií]cola|extrativismo|silvicultura/.test(
    t,
  )
}
