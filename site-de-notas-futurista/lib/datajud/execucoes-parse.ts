import { extractAssuntos, extractClasse } from "@/lib/datajud/trabalhista-parse"

const CLASSES_EXECUCAO_DEFAULT = new Set([1116, 877, 40])

function isPoloPassivo(parte: Record<string, unknown>) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function hasAdvogadoPassivo(source: Record<string, unknown>) {
  const partes = (source.partes || []) as Record<string, unknown>[]
  for (const parte of partes) {
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
  return /produtor rural|agropecu|fazenda|sitio|s[ií]tio|ch[aá]cara|nirf|car\b|lavoura|pecu[aá]ria/.test(t)
}

export function parseExecucaoSource(source: Record<string, unknown>, tribunalLabel: string) {
  const { codigo: classe_codigo, nome: classe_nome } = extractClasse(source)
  if (classe_codigo != null && !CLASSES_EXECUCAO_DEFAULT.has(classe_codigo)) return null
  if (hasAdvogadoPassivo(source)) return null

  const partes = (source.partes || []) as Record<string, unknown>[]
  const reu = partes.find(isPoloPassivo) || partes[0]
  if (!reu) return null

  const nomeReu = String(reu.nome || "Réu não identificado").trim()
  const assuntos = extractAssuntos(source)
  const texto = [nomeReu, String(source.objeto || source.assunto || ""), assuntos].join(" ")

  if (!isRuralProducer(texto)) return null

  const orgao = (source.orgaoJulgador || {}) as Record<string, unknown>
  const valor = parseFloat(String(source.valorCausa || source.valor || 0)) || 0
  const credor = partes.find((p) => !isPoloPassivo(p))

  return {
    nome_reu: nomeReu,
    cpf_cnpj: null as string | null,
    tipo_reu: /ltda|s\.?a|me\b|eireli|cnpj/i.test(nomeReu) ? "PJ" : "PF",
    numero_processo: String(source.numeroProcesso || "").replace(/\D/g, ""),
    numero_processo_formatado: String(source.numeroProcesso || ""),
    tribunal: tribunalLabel,
    vara: String(orgao.nome || orgao.nomeOrgao || tribunalLabel),
    comarca: (orgao.municipioNome || orgao.nomeMunicipio || null) as string | null,
    valor_execucao: valor,
    credor_exequente: credor ? String(credor.nome || "") : null,
    data_ajuizamento: (source.dataAjuizamento || null) as string | null,
    tem_advogado: false,
    imoveis_rurais: [] as unknown[],
    nirf: null,
    car_numero: null,
    area_hectares: null,
    municipio_imovel: (orgao.municipioNome || null) as string | null,
    classe_codigo,
    classe_nome,
    assuntos,
    texto_rural: texto,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}
