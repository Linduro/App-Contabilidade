import { ALTO_VALOR_MIN, CLASSES_EXECUCAO_ALTO_VALOR } from "@/lib/datajud/alto-valor-constants"
import { extractClasse } from "@/lib/datajud/trabalhista-parse"

const CLASSES_SET = new Set<number>(CLASSES_EXECUCAO_ALTO_VALOR)

function isPoloPassivo(parte: Record<string, unknown>) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function executadoSemAdvogado(parte: Record<string, unknown>) {
  const reps = (parte.representantes || parte.advogados || []) as unknown[]
  return !Array.isArray(reps) || reps.length === 0
}

function extractDoc(parte: Record<string, unknown>) {
  const docs = (parte.documentosPrincipais || parte.documentos || []) as Array<{ numero?: string }>
  for (const doc of docs) {
    const digits = String(doc.numero || "").replace(/\D/g, "")
    if (digits.length === 11 || digits.length === 14) return digits
  }
  return null
}

export function parseAltoValorSource(source: Record<string, unknown>, tribunalLabel: string) {
  const { codigo: classeCodigo } = extractClasse(source)
  if (classeCodigo == null || !CLASSES_SET.has(classeCodigo)) return null

  const valor = parseFloat(String(source.valorCausa || source.valor || 0))
  if (!Number.isFinite(valor) || valor < ALTO_VALOR_MIN) return null

  const partes = (source.partes || []) as Record<string, unknown>[]
  const executadoParte = partes.find(isPoloPassivo)
  if (!executadoParte || !executadoSemAdvogado(executadoParte)) return null

  for (const parte of partes) {
    if (!isPoloPassivo(parte)) continue
    if (!executadoSemAdvogado(parte)) return null
  }

  const exequenteParte = partes.find((p) => !isPoloPassivo(p))
  const executado = String(executadoParte.nome || "Executado não identificado").trim()
  const cnpjCpf = extractDoc(executadoParte)
  const orgao = (source.orgaoJulgador || {}) as Record<string, unknown>
  const numeroProcesso = String(source.numeroProcesso || "").replace(/\D/g, "")

  return {
    numeroProcesso,
    processo: String(source.numeroProcesso || numeroProcesso),
    tribunal: tribunalLabel,
    vara: String(orgao.nome || orgao.nomeOrgao || tribunalLabel),
    comarca: String(orgao.municipioNome || orgao.nomeMunicipio || orgao.nome || "—"),
    valorCausa: valor,
    exequente: exequenteParte ? String(exequenteParte.nome || "") : null,
    executado,
    cnpjCpf: cnpjCpf || "",
    tipoExecutado: (cnpjCpf?.length === 14 || /ltda|s\.?a|me\b|eireli/i.test(executado)
      ? "PJ"
      : "PF") as "PF" | "PJ",
    dataAjuizamento: (source.dataAjuizamento || null) as string | null,
    ultimoMovimento: (source.dataUltimaAtualizacao || source.dataHoraUltimaAtualizacao || source.dataAjuizamento || null) as string | null,
    temAdvogado: false,
    classeCodigo,
    comarcaInterior: true,
    dadosBrutos: source,
  }
}
