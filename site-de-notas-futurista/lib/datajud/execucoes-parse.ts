import {
  CAPA_EMPRESA_PLACEHOLDER,
  extractComarcaFromOrgao,
  extractOrgao,
  extractPartes,
  extractValorCausa,
  hasPartesMetadata,
} from "@/lib/datajud/metadata"
import { extractAssuntos, extractClasse } from "@/lib/datajud/trabalhista-parse"

const CLASSES_EXECUCAO_DEFAULT = new Set([1116, 877, 40])

function isPoloPassivo(parte: Record<string, unknown>) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function hasAdvogadoPassivo(source: Record<string, unknown>) {
  for (const parte of extractPartes(source)) {
    if (!isPoloPassivo(parte)) continue
    const reps = (parte.advogados || parte.representantes || []) as unknown[]
    if (Array.isArray(reps) && reps.length > 0) return true
  }
  return Boolean(
    (Array.isArray(source.advogados) && source.advogados.length) ||
      (Array.isArray(source.representantes) && source.representantes.length),
  )
}

function isRuralProducer(text: string) {
  const t = text.toLowerCase()
  return /produtor rural|agropecu|fazenda|sitio|s[ií]tio|ch[aá]cara|nirf|car\b|lavoura|pecu[aá]ria|agr[ií]cola|extrativismo|silvicultura/.test(
    t,
  )
}

function buildBaseFields(source: Record<string, unknown>, tribunalLabel: string) {
  const orgao = extractOrgao(source)
  const vara = String(orgao.nome || orgao.nomeOrgao || tribunalLabel)
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const { codigo: classe_codigo, nome: classe_nome } = extractClasse(source)
  const assuntos = extractAssuntos(source)
  const valor = extractValorCausa(source)

  return {
    numero_processo: String(source.numeroProcesso || "").replace(/\D/g, ""),
    numero_processo_formatado: String(source.numeroProcesso || ""),
    tribunal: tribunalLabel,
    vara,
    comarca,
    valor_execucao: valor ?? 0,
    data_ajuizamento: (source.dataAjuizamento || null) as string | null,
    classe_codigo,
    classe_nome,
    assuntos,
    municipio_imovel: comarca,
  }
}

export function parseExecucaoSource(source: Record<string, unknown>, tribunalLabel: string) {
  const { codigo: classe_codigo } = extractClasse(source)
  if (classe_codigo != null && !CLASSES_EXECUCAO_DEFAULT.has(classe_codigo)) return null

  const base = buildBaseFields(source, tribunalLabel)
  if (!base.numero_processo) return null

  const capaApenas = !hasPartesMetadata(source)
  const assuntos = base.assuntos
  const orgao = extractOrgao(source)
  const textoCapa = [assuntos, String(orgao.nome || ""), String(source.objeto || "")].join(" ")

  if (capaApenas) {
    const isExecClass =
      classe_codigo != null && CLASSES_EXECUCAO_DEFAULT.has(classe_codigo)
    if (!isExecClass && !isRuralProducer(textoCapa)) return null

    return {
      ...base,
      nome_reu: CAPA_EMPRESA_PLACEHOLDER,
      cpf_cnpj: null as string | null,
      tipo_reu: "PF" as const,
      credor_exequente: null,
      tem_advogado: false,
      imoveis_rurais: [] as unknown[],
      nirf: null,
      car_numero: null,
      area_hectares: null,
      texto_rural: textoCapa,
      capa_datajud: true,
      dados_brutos: { datajud: source, tribunal: tribunalLabel },
    }
  }

  if (hasAdvogadoPassivo(source)) return null

  const partes = extractPartes(source)
  const reu = partes.find(isPoloPassivo) || partes[0]
  if (!reu) return null

  const nomeReu = String(reu.nome || CAPA_EMPRESA_PLACEHOLDER).trim()
  const texto = [nomeReu, String(source.objeto || source.assunto || ""), assuntos].join(" ")

  if (!isRuralProducer(texto)) return null

  const credor = partes.find((p) => !isPoloPassivo(p))

  return {
    ...base,
    nome_reu: nomeReu,
    cpf_cnpj: null as string | null,
    tipo_reu: (/ltda|s\.?a|me\b|eireli|cnpj/i.test(nomeReu) ? "PJ" : "PF") as "PF" | "PJ",
    credor_exequente: credor ? String(credor.nome || "") : null,
    tem_advogado: false,
    imoveis_rurais: [] as unknown[],
    nirf: null,
    car_numero: null,
    area_hectares: null,
    texto_rural: texto,
    capa_datajud: false,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}
