const BASE = "https://brasilapi.com.br/api/cnpj/v1"

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "")
}

function pickPhone(data) {
  const ddd = data.ddd_telefone_1 || data.ddd1 || ""
  const tel = data.telefone_1 || data.telefone1 || ""
  const digits = `${ddd}${tel}`.replace(/\D/g, "")
  return digits.length >= 10 ? digits : null
}

function pickEmail(data) {
  const email = data.email
  return email && email.includes("@") ? email.trim().toLowerCase() : null
}

function pickResponsavel(qsa) {
  if (!Array.isArray(qsa) || qsa.length === 0) return null
  const priority = ["49", "10", "16", "08"]
  for (const code of priority) {
    const found = qsa.find((q) => String(q.qualificacao_socio) === code)
    if (found?.nome_socio) return found.nome_socio.trim()
  }
  return qsa[0]?.nome_socio?.trim() || null
}

function mapQsa(qsa) {
  if (!Array.isArray(qsa)) return []
  return qsa.map((q) => ({
    nome: q.nome_socio,
    qualificacao: q.qualificacao_socio_descricao || String(q.qualificacao_socio),
  }))
}

async function fetchCnpjData(cnpj) {
  const digits = onlyDigits(cnpj)
  if (digits.length !== 14) return null

  const response = await fetch(`${BASE}/${digits}`, {
    headers: { Accept: "application/json" },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`BrasilAPI CNPJ HTTP ${response.status}`)

  const data = await response.json()
  return {
    cnpj: digits,
    razao_social: data.razao_social || data.nome_fantasia || null,
    responsavel: pickResponsavel(data.qsa),
    telefone: pickPhone(data),
    email: pickEmail(data),
    cnae_fiscal: data.cnae_fiscal || null,
    municipio: data.municipio || null,
    uf: data.uf || null,
    qsa_socios: mapQsa(data.qsa),
    site_url: data.website || null,
    dados_brutos: data,
  }
}

module.exports = { fetchCnpjData, onlyDigits }
