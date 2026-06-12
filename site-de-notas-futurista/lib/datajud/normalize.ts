/**
 * Normalização ampla — extrai metadados sem descartar por regras de negócio.
 * Triagem e filtros ficam a cargo do advogado na UI.
 */
import { DATAJUD_SEARCH_DAYS, isWithinDaysBack } from "@/lib/datajud/compact-date"
import { ALTO_VALOR_MIN, CLASSES_EXECUCAO_ALTO_VALOR } from "@/lib/datajud/alto-valor-constants"
import {
  CAPA_EMPRESA_PLACEHOLDER,
  CAPA_EXECUTADO_PLACEHOLDER,
  extractComarcaFromOrgao,
  extractOrgao,
  extractPartes,
  extractValorCausa,
  hasPartesMetadata,
} from "@/lib/datajud/metadata"
import { detectAdvogadoPassivo, detectIndicioRural } from "@/lib/datajud/advogado-detect"
import { extractAssuntos, extractClasse } from "@/lib/datajud/trabalhista-parse"

export { DATAJUD_SEARCH_DAYS }

const CLASSES_EXECUCAO = new Set([1116, 877, 40])
const CLASSES_ALTO_VALOR = new Set<number>(CLASSES_EXECUCAO_ALTO_VALOR)

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
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function extractDoc(parte: Record<string, unknown>) {
  const docs = (parte.documentosPrincipais || parte.documentos || []) as Array<{ numero?: string }>
  for (const doc of docs) {
    const digits = String(doc.numero || "").replace(/\D/g, "")
    if (digits.length === 11 || digits.length === 14) return digits
  }
  return null
}

export function normalizeTrabalhistaSource(source: Record<string, unknown>, trt: number) {
  if (!isWithinDaysBack(source.dataAjuizamento as string)) return null

  const numeroProcesso = normalizeProcesso(source.numeroProcesso)
  if (!numeroProcesso) return null

  const orgao = extractOrgao(source)
  const vara = String(orgao.nome || orgao.nomeOrgao || `TRT-${trt}`)
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const assuntos = extractAssuntos(source)
  const { codigo: classe_codigo, nome: classe_nome } = extractClasse(source)
  const valor = extractValorCausa(source)
  const capaApenas = !hasPartesMetadata(source)
  const tem_advogado = detectAdvogadoPassivo(source)

  let empresa = CAPA_EMPRESA_PLACEHOLDER
  let cnpj: string | null = null
  let reu_pj: boolean | null = null

  if (!capaApenas) {
    const partes = extractPartes(source)
    const reus = partes.filter(isPoloPassivo)
    const reu = reus.find(isPessoaJuridica) || reus[0] || partes[0]
    if (reu) {
      empresa = String(reu.nome || CAPA_EMPRESA_PLACEHOLDER).trim()
      cnpj = extractCnpjFromParte(reu)
      reu_pj = isPessoaJuridica(reu)
    }
  }

  return {
    numero_processo: numeroProcesso,
    numero_processo_formatado: String(source.numeroProcesso || numeroProcesso),
    empresa,
    cnpj,
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
    capa_datajud: capaApenas,
    tem_advogado,
    reu_pj,
    dados_brutos: { datajud: source, trt },
  }
}

export function normalizeExecucaoSource(source: Record<string, unknown>, tribunalLabel: string) {
  if (!isWithinDaysBack(source.dataAjuizamento as string)) return null

  const numero_processo = normalizeProcesso(source.numeroProcesso)
  if (!numero_processo) return null

  const orgao = extractOrgao(source)
  const vara = String(orgao.nome || orgao.nomeOrgao || tribunalLabel)
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const { codigo: classe_codigo, nome: classe_nome } = extractClasse(source)
  const assuntos = extractAssuntos(source)
  const valor = extractValorCausa(source)
  const capaApenas = !hasPartesMetadata(source)
  const tem_advogado = detectAdvogadoPassivo(source)
  const textoCapa = [assuntos, vara, String(source.objeto || "")].join(" ")
  const indicio_rural = detectIndicioRural(textoCapa)
  const classe_execucao = classe_codigo != null && CLASSES_EXECUCAO.has(classe_codigo)

  let nome_reu = CAPA_EMPRESA_PLACEHOLDER
  let tipo_reu: "PF" | "PJ" = "PF"
  let credor_exequente: string | null = null
  let cpf_cnpj: string | null = null
  let texto_rural = textoCapa

  if (!capaApenas) {
    const partes = extractPartes(source)
    const reu = partes.find(isPoloPassivo) || partes[0]
    if (reu) {
      nome_reu = String(reu.nome || CAPA_EMPRESA_PLACEHOLDER).trim()
      cpf_cnpj = extractDoc(reu)
      tipo_reu = isPessoaJuridica(reu) || /ltda|s\.?a|me\b|eireli|cnpj/i.test(nome_reu) ? "PJ" : "PF"
      texto_rural = [nome_reu, String(source.objeto || ""), assuntos].join(" ")
    }
    const credor = partes.find((p) => !isPoloPassivo(p))
    credor_exequente = credor ? String(credor.nome || "") : null
  }

  return {
    numero_processo,
    numero_processo_formatado: String(source.numeroProcesso || numero_processo),
    nome_reu,
    cpf_cnpj,
    tipo_reu,
    tribunal: tribunalLabel,
    vara,
    comarca,
    valor_execucao: valor ?? 0,
    data_ajuizamento: (source.dataAjuizamento || null) as string | null,
    classe_codigo,
    classe_nome,
    assuntos,
    credor_exequente,
    tem_advogado,
    indicio_rural: indicio_rural || detectIndicioRural(texto_rural),
    classe_execucao,
    imoveis_rurais: [] as unknown[],
    nirf: null,
    car_numero: null,
    area_hectares: null,
    texto_rural,
    municipio_imovel: comarca,
    capa_datajud: capaApenas,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}

export function normalizeAltoValorSource(source: Record<string, unknown>, tribunalLabel: string) {
  if (!isWithinDaysBack(source.dataAjuizamento as string)) return null

  const numeroProcesso = normalizeProcesso(source.numeroProcesso)
  if (!numeroProcesso) return null

  const orgao = extractOrgao(source)
  const vara = String(orgao.nome || orgao.nomeOrgao || tribunalLabel)
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const { codigo: classeCodigo } = extractClasse(source)
  const valor = extractValorCausa(source)
  const capaApenas = !hasPartesMetadata(source)
  const temAdvogado = detectAdvogadoPassivo(source)
  const classe_execucao = classeCodigo != null && CLASSES_ALTO_VALOR.has(classeCodigo)
  const alto_valor = valor != null ? valor >= ALTO_VALOR_MIN : null

  let executado = CAPA_EXECUTADO_PLACEHOLDER
  let cnpjCpf = ""
  let tipoExecutado: "PF" | "PJ" = "PF"
  let exequente: string | null = null

  if (!capaApenas) {
    const partes = extractPartes(source)
    const executadoParte = partes.find(isPoloPassivo) || partes[0]
    if (executadoParte) {
      executado = String(executadoParte.nome || CAPA_EXECUTADO_PLACEHOLDER).trim()
      cnpjCpf = extractDoc(executadoParte) || ""
      tipoExecutado =
        cnpjCpf.length === 14 || /ltda|s\.?a|me\b|eireli/i.test(executado) ? "PJ" : "PF"
    }
    const exequenteParte = partes.find((p) => !isPoloPassivo(p))
    exequente = exequenteParte ? String(exequenteParte.nome || "") : null
  }

  return {
    numeroProcesso,
    processo: String(source.numeroProcesso || numeroProcesso),
    tribunal: tribunalLabel,
    vara,
    comarca,
    valorCausa: valor,
    exequente,
    executado,
    cnpjCpf,
    tipoExecutado,
    dataAjuizamento: (source.dataAjuizamento || null) as string | null,
    ultimoMovimento: (source.dataUltimaAtualizacao ||
      source.dataHoraUltimaAtualizacao ||
      source.dataAjuizamento ||
      null) as string | null,
    temAdvogado,
    classeCodigo,
    classe_execucao,
    alto_valor,
    comarcaInterior: true,
    capaDatajud: capaApenas,
    dadosBrutos: source,
  }
}
