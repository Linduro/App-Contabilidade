/**
 * Cria usuário demo e grava leads de exemplo via REST (sem service account).
 * Uso: node scripts/setup-afs-demo.mjs
 */
const API_KEY = "AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk"
const PROJECT = "contabilidade-ebed6"
const EMAIL = process.env.AFS_DEMO_EMAIL || "afs.market.demo@gmail.com"
const PASSWORD = process.env.AFS_DEMO_PASSWORD || "AfsMarket2026!"

async function authRequest(path, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error?.message || JSON.stringify(data))
  return data
}

async function getIdToken() {
  try {
    const data = await authRequest("accounts:signInWithPassword", {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    })
    return data.idToken
  } catch {
    const data = await authRequest("accounts:signUp", {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    })
    console.log("Usuário criado:", EMAIL)
    return data.idToken
  }
}

function firestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === "string") return { stringValue: v }
  if (typeof v === "number") return { doubleValue: v }
  if (typeof v === "boolean") return { booleanValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(firestoreValue) } }
  if (typeof v === "object") {
    const fields = {}
    for (const [k, val] of Object.entries(v)) fields[k] = firestoreValue(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

async function addDoc(token, collection, data) {
  const fields = {}
  for (const [k, v] of Object.entries(data)) fields[k] = firestoreValue(v)
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  )
  const out = await r.json()
  if (!r.ok) throw new Error(out.error?.message || JSON.stringify(out))
  return out.name?.split("/").pop()
}

const now = new Date()
const daysAgo = (n) => new Date(Date.now() - n * 86400000)

const leads = [
  {
    cnpj_basico: "12345678",
    razao_social: "Holding Patrimonial Alfa Ltda",
    cnae_codigo: "6422-1/00",
    cnae_descricao: "Bancos múltiplos",
    regime_tributario: "LR",
    capital_social: 5000000,
    receita_anual_estimada: 12000000,
    porte_empresa: "MEDIO",
    qtd_filiais: 3,
    situacao_cadastral: "ATIVA",
    uf: "SP",
    municipio: "São Paulo",
    telefone: "(11) 3000-0001",
    email: "contato@holdingalfa.com.br",
    cluster: "Patrimonial",
    score: 8.5,
    transicao_regime: true,
    perfil_icp: "patrimonial",
    status_funil: "prospectado",
    criado_em: daysAgo(15),
    atualizado_em: now,
  },
  {
    cnpj_basico: "87654321",
    razao_social: "Indústria Beta EPP",
    cnae_codigo: "2511-0/00",
    cnae_descricao: "Fabricação de estruturas metálicas",
    regime_tributario: "LP",
    capital_social: 800000,
    porte_empresa: "EPP",
    qtd_filiais: 1,
    situacao_cadastral: "ATIVA",
    uf: "MG",
    municipio: "Belo Horizonte",
    telefone: "(31) 3200-0002",
    email: "financeiro@betaind.com.br",
    cluster: "Industrial",
    score: 6.2,
    transicao_regime: false,
    perfil_icp: "generico",
    status_funil: "contato_feito",
    criado_em: daysAgo(30),
    atualizado_em: now,
  },
  {
    cnpj_basico: "11223344",
    razao_social: "Comércio Gama ME",
    cnae_codigo: "4711-3/01",
    cnae_descricao: "Comércio varejista",
    regime_tributario: "SN",
    capital_social: 50000,
    porte_empresa: "ME",
    situacao_cadastral: "ATIVA",
    uf: "RJ",
    municipio: "Rio de Janeiro",
    telefone: "(21) 2500-0003",
    email: "",
    cluster: "Varejo",
    score: 3.1,
    transicao_regime: false,
    perfil_icp: "generico",
    status_funil: "dead_zone",
    motivo_dead_zone: "Sem e-mail válido",
    rota_recomendada: "LinkedIn",
    prioridade: "Média",
    criado_em: daysAgo(45),
    atualizado_em: now,
  },
  {
    cnpj_basico: "99887766",
    razao_social: "Agro Delta Lucro Real SA",
    cnae_codigo: "0111-3/01",
    cnae_descricao: "Cultivo de cereais",
    regime_tributario: "LR",
    capital_social: 12000000,
    porte_empresa: "GRANDE",
    qtd_filiais: 8,
    situacao_cadastral: "ATIVA",
    uf: "GO",
    municipio: "Goiânia",
    telefone: "(62) 3300-0004",
    email: "cfo@agrodelta.com.br",
    cluster: "Agro",
    score: 9.1,
    transicao_regime: true,
    data_transicao: daysAgo(12),
    perfil_icp: "transicao_regime",
    status_funil: "prospectado",
    criado_em: daysAgo(10),
    atualizado_em: now,
  },
]

async function main() {
  console.log("Autenticando como", EMAIL, "...")
  const token = await getIdToken()
  console.log("Gravando leads de demonstração...")
  for (const lead of leads) {
    const id = await addDoc(token, "leads", lead)
    console.log("  +", id, lead.razao_social)
  }
  const pid = await addDoc(token, "parceiros", {
    nome: "Audit Partners SP",
    rede: "Rede Nacional",
    uf_sede: "SP",
    website: "https://auditpartners.com.br",
    email_contato: "parcerias@auditpartners.com.br",
    telefone: "(11) 4000-1000",
    status_parceria: "ativo",
    criado_em: now,
  })
  console.log("  + parceiro", pid)
  console.log("\nPronto! Login na SPA:")
  console.log("  E-mail:", EMAIL)
  console.log("  Senha:", PASSWORD)
}

main().catch((e) => {
  console.error("[AFS-ERROR]", e.message || e)
  process.exit(1)
})
