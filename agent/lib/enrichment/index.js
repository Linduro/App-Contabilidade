/**
 * Enriquecimento profundo de contatos — 4 camadas sequenciais.
 * Para quando email + telefone >= 0.7 de confiança.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/gi
const PHONE_RE = /(\(?\d{2}\)?[\s-]?)(9?\d{4})[\s-]?\d{4}/g

const CNAES_RURAL = [
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

function emptyContatos() {
  return {
    contatos: {},
    socioNome: null,
    socioQualificacao: null,
    enriquecidoEm: null,
    camadaMaximaAtingida: 0,
    enriquecimento_parcial: true,
  }
}

function setField(contatos, key, valor, fonte, confianca) {
  if (!valor) return
  const existing = contatos.contatos[key]
  if (existing && existing.confianca >= confianca) return
  contatos.contatos[key] = { valor, fonte, confianca }
}

function hasStrongContact(contatos) {
  const email = contatos.contatos.email?.confianca ?? 0
  const tel = contatos.contatos.telefone?.confianca ?? 0
  return email >= 0.7 && tel >= 0.7
}

async function layer1Public(record, contatos) {
  const { fetchCnpjData } = require("../modules/shared/brasilapi")

  if (record.cnpj || record.cpf_cnpj) {
    const doc = record.cnpj || record.cpf_cnpj
    try {
      const data = await fetchCnpjData(doc)
      if (data) {
        if (data.telefone) {
          setField(contatos, "telefone", data.telefone, "cnpj", 0.85)
        }
        if (data.email) setField(contatos, "email", data.email, "cnpj", 0.9)
        if (data.responsavel) {
          contatos.socioNome = data.responsavel
          contatos.socioQualificacao = "Sócio (QSA)"
        }
        if (data.qsa_socios?.length) {
          const admin = data.qsa_socios.find((s) => s.qualificacao) || data.qsa_socios[0]
          contatos.socioNome = admin.nome
          contatos.socioQualificacao = admin.qualificacao
        }
      }
    } catch (e) {
      console.warn("[enrich L1] brasilapi:", e.message)
    }
  }

  if (record.car_numero || record.municipio_imovel) {
    setField(
      contatos,
      "enderecoImovel",
      record.endereco_imovel ||
        `${record.municipio_imovel || ""}${record.area_hectares ? ` — ${record.area_hectares} ha` : ""}`.trim(),
      "car",
      0.9,
    )
  }

  contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 1)
}

async function layer2Web(record, contatos) {
  const url = record.site_url || record.url_empresa
  if (!url) {
    contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 2)
    return
  }

  try {
    const pages = [url, `${url.replace(/\/$/, "")}/contato`, `${url.replace(/\/$/, "")}/contact`]
    for (const page of pages.slice(0, 3)) {
      const res = await fetch(page, {
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const emails = html.match(EMAIL_RE) || []
      const phones = html.match(PHONE_RE) || []
      if (emails[0]) setField(contatos, "email", emails[0], "site", 0.7)
      if (phones[0]) {
        setField(contatos, "telefone", phones[0], "site", 0.7)
      }
    }
  } catch (e) {
    console.warn("[enrich L2] site:", e.message)
  }

  contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 2)
}

async function layer3Social(record, contatos) {
  const nome = contatos.socioNome || record.nome_reu || record.empresa || record.responsavel
  if (!nome) {
    contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 3)
    return
  }

  const slug = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

  if (slug) {
    setField(
      contatos,
      "linkedin",
      `linkedin.com/in/${slug}`,
      "estimativa_linkedin",
      0.45,
    )
  }

  contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 3)
}

async function layer4Estimate(record, contatos) {
  if (hasStrongContact(contatos)) return

  const municipio = record.municipio || record.municipio_imovel || record.comarca
  if (municipio) {
    setField(
      contatos,
      "telefone",
      `(estimado DDD região ${municipio})`,
      "estimado",
      0.25,
    )
  }
  contatos.camadaMaximaAtingida = Math.max(contatos.camadaMaximaAtingida, 4)
}

async function enrichContacts(record) {
  const contatos = emptyContatos()

  await layer1Public(record, contatos)
  if (hasStrongContact(contatos)) {
    contatos.enriquecimento_parcial = false
    contatos.enriquecidoEm = new Date().toISOString()
    return contatos
  }

  await layer2Web(record, contatos)
  if (hasStrongContact(contatos)) {
    contatos.enriquecimento_parcial = false
    contatos.enriquecidoEm = new Date().toISOString()
    return contatos
  }

  await layer3Social(record, contatos)
  if (hasStrongContact(contatos)) {
    contatos.enriquecimento_parcial = false
    contatos.enriquecidoEm = new Date().toISOString()
    return contatos
  }

  await layer4Estimate(record, contatos)
  contatos.enriquecimento_parcial = !hasStrongContact(contatos)
  contatos.enriquecidoEm = new Date().toISOString()
  return contatos
}

function isRuralProducer(text, cnae) {
  const t = String(text || "").toLowerCase()
  if (/produtor rural|agropecu|fazenda|sitio|s[ií]tio|ch[aá]cara|nirf|car\b|lavoura|pecu[aá]ria/.test(t)) {
    return true
  }
  const c = String(cnae || "").replace(/\D/g, "").slice(0, 4)
  return CNAES_RURAL.some((prefix) => c.startsWith(prefix))
}

module.exports = {
  enrichContacts,
  isRuralProducer,
  hasStrongContact,
  CNAES_RURAL,
}
