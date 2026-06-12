import {
  CAPA_EMPRESA_PLACEHOLDER,
  extractComarcaFromOrgao,
  extractOrgao,
  extractPartes,
  extractValorCausa,
  hasPartesMetadata,
} from "@/lib/datajud/metadata"

export function extractClasse(source: Record<string, unknown>) {
  const c = (source.classe || source.classeProcessual || {}) as Record<string, unknown>
  const codigo = c.codigo ?? c.code ?? c.numero ?? null
  const nome = String(c.nome ?? c.descricao ?? c.name ?? "").trim() || null
  return {
    codigo: codigo != null ? Number(codigo) : null,
    nome,
  }
}

export function extractAssuntos(source: Record<string, unknown>): string {
  const assuntos = source.assuntos as Array<{ nome?: string; descricao?: string }> | undefined
  if (!Array.isArray(assuntos)) return ""
  return assuntos.map((a) => a.nome || a.descricao || "").filter(Boolean).join("; ")
}

function normalizeProcesso(num: unknown) {
  return String(num || "").replace(/\D/g, "")
}

function extractCnpjFromParte(parte: Record<string, unknown>) {
  const docs = (parte.documentosPrincipais || parte.documentos || []) as Array<{ numero?: string }>
  for (const doc of docs) {
    const digits = String(doc.numero || "").replace(/\D/g, "")
    if (digits.length === 14) return digits
  }
  const match = String(parte.nome || "").match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
  return match ? match[0].replace(/\D/g, "") : null
}

function isPessoaJuridica(parte: Record<string, unknown>) {
  const tipo = String(parte.tipoPessoa || parte.tipo || "").toUpperCase()
  if (tipo.includes("JUR") || tipo === "PJ") return true
  return Boolean(extractCnpjFromParte(parte))
}

function isPoloPassivo(parte: Record<string, unknown>) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("RÉU") || polo.includes("REU")
}

function hasAdvogadoConstituido(source: Record<string, unknown>) {
  if (Array.isArray(source.advogados) && source.advogados.length) return true
  for (const parte of extractPartes(source)) {
    if (!isPoloPassivo(parte)) continue
    const reps = (parte.advogados || parte.representantes || []) as unknown[]
    if (Array.isArray(reps) && reps.length) return true
  }
  return false
}

export function parseTrabalhistaSource(source: Record<string, unknown>, trt: number) {
  const numeroProcesso = normalizeProcesso(source.numeroProcesso)
  if (!numeroProcesso) return null

  const orgao = extractOrgao(source)
  const vara = String(orgao.nome || orgao.nomeOrgao || `TRT-${trt}`)
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const assuntos = extractAssuntos(source)
  const { codigo: classe_codigo, nome: classe_nome } = extractClasse(source)
  const valor = extractValorCausa(source)
  const capaApenas = !hasPartesMetadata(source)

  if (capaApenas) {
    return {
      numero_processo: numeroProcesso,
      numero_processo_formatado: String(source.numeroProcesso || numeroProcesso),
      empresa: CAPA_EMPRESA_PLACEHOLDER,
      cnpj: null as string | null,
      vara,
      comarca,
      tribunal: `TRT-${trt}`,
      valor_causa: valor ?? 0,
      data_ajuizamento: (source.dataAjuizamento || source.dataHoraAjuizamento || null) as string | null,
      ultima_movimentacao: null,
      sem_movimentacao_posterior: true,
      setor: /agro|fazenda|pecu/i.test(assuntos) ? "agro" : "outros",
      comarca_interior: true,
      classe_codigo,
      classe_nome,
      assuntos,
      capa_datajud: true,
      dados_brutos: { datajud: source, trt },
    }
  }

  if (hasAdvogadoConstituido(source)) return null

  const partes = extractPartes(source)
  const reusPj = partes.filter((p) => isPoloPassivo(p) && isPessoaJuridica(p))
  if (!reusPj.length) return null

  const reu = reusPj[0]
  const empresa = String(reu.nome || "Empresa não identificada").trim()

  return {
    numero_processo: numeroProcesso,
    numero_processo_formatado: String(source.numeroProcesso || numeroProcesso),
    empresa,
    cnpj: extractCnpjFromParte(reu),
    vara,
    comarca,
    tribunal: `TRT-${trt}`,
    valor_causa: valor ?? 0,
    data_ajuizamento: (source.dataAjuizamento || source.dataHoraAjuizamento || null) as string | null,
    ultima_movimentacao: null,
    sem_movimentacao_posterior: true,
    setor: /agro|fazenda|pecu/i.test(`${empresa} ${assuntos}`) ? "agro" : "outros",
    comarca_interior: true,
    classe_codigo,
    classe_nome,
    assuntos,
    capa_datajud: false,
    dados_brutos: { datajud: source, trt },
  }
}
