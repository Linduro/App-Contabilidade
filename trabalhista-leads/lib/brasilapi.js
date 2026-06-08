const BASE = "https://brasilapi.com.br/api/cnpj/v1"

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "")
}

function pickPhone(estabelecimento) {
  const ddd = estabelecimento?.ddd1 || estabelecimento?.ddd || ""
  const tel = estabelecimento?.telefone1 || estabelecimento?.telefone || ""
  const digits = `${ddd}${tel}`.replace(/\D/g, "")
  if (digits.length >= 10) return digits
  return null
}

function pickEmail(data) {
  const email = data.email || data.estabelecimento?.email
  if (email && email.includes("@")) return email.trim().toLowerCase()
  return null
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

async function fetchCnpjData(cnpj) {
  const digits = onlyDigits(cnpj)
  if (digits.length !== 14) return null

  const response = await fetch(`${BASE}/${digits}`, {
    headers: { Accept: "application/json" },
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`BrasilAPI CNPJ HTTP ${response.status}`)
  }

  const data = await response.json()

  return {
    cnpj: digits,
    razao_social: data.razao_social || data.nome_fantasia || null,
    nome_fantasia: data.nome_fantasia || null,
    responsavel: pickResponsavel(data.qsa),
    telefone: pickPhone(data),
    email: pickEmail(data),
    cnae_fiscal: data.cnae_fiscal || null,
    municipio: data.municipio || null,
    uf: data.uf || null,
    dados_brutos: data,
  }
}

module.exports = { fetchCnpjData, onlyDigits }
