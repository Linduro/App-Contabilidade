/**
 * Provisiona usuários AFS Market Intelligence (owner + Gabriel).
 * - Garante contas no Firebase Auth
 * - Envia e-mail de redefinição de senha se a conta já existir
 * - Popula leads demo se a base estiver vazia
 *
 * Uso:
 *   node scripts/setup-afs-users.mjs
 *   AFS_USER_PASSWORD="sua-senha" node scripts/setup-afs-users.mjs
 */
const API_KEY = "AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk"
const PROJECT = "contabilidade-ebed6"

const AFS_USERS = [
  { email: "cartoonhq@gmail.com", label: "Owner" },
  { email: "gabrieldouran@gmail.com", label: "Gabriel" },
]

const TEMP_PASSWORD = process.env.AFS_USER_PASSWORD || "AfsMarket2026!"

async function authRequest(path, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  return { ok: r.ok, data }
}

async function ensureUser({ email, label }) {
  const signIn = await authRequest("accounts:signInWithPassword", {
    email,
    password: TEMP_PASSWORD,
    returnSecureToken: true,
  })
  if (signIn.ok) {
    console.log(`✓ ${label} (${email}) — conta OK, login com senha configurada`)
    return signIn.data.idToken
  }

  const signUp = await authRequest("accounts:signUp", {
    email,
    password: TEMP_PASSWORD,
    returnSecureToken: true,
  })
  if (signUp.ok) {
    console.log(`✓ ${label} (${email}) — conta criada`)
    console.log(`  Senha inicial: ${TEMP_PASSWORD} (altere após o primeiro login)`)
    return signUp.data.idToken
  }

  const err = signUp.data.error?.message || ""
  if (err.includes("EMAIL_EXISTS") || err.includes("already")) {
    const reset = await authRequest("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email,
    })
    if (reset.ok) {
      console.log(`↻ ${label} (${email}) — e-mail de redefinição de senha enviado`)
    } else {
      console.log(`! ${label} (${email}) — já existe; defina senha no Firebase Console`)
    }
    return null
  }

  throw new Error(`${email}: ${err || JSON.stringify(signUp.data)}`)
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

async function countMarketLeads(token) {
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "leads" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "cnpj_basico" },
              op: "GREATER_THAN",
              value: { stringValue: "" },
            },
          },
          limit: 1,
        },
      }),
    },
  )
  const rows = await r.json()
  if (!r.ok) return -1
  return Array.isArray(rows) && rows.some((row) => row.document) ? 1 : 0
}

async function addDoc(token, collection, data) {
  const fields = {}
  for (const [k, v] of Object.entries(data)) fields[k] = firestoreValue(v)
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  )
  const out = await r.json()
  if (!r.ok) throw new Error(out.error?.message || JSON.stringify(out))
  return out.name?.split("/").pop()
}

const now = new Date()
const daysAgo = (n) => new Date(Date.now() - n * 86400000)

const sampleLeads = [
  {
    cnpj_basico: "12345678",
    razao_social: "Holding Patrimonial Alfa Ltda",
    cnae_codigo: "6422-1/00",
    cnae_descricao: "Bancos múltiplos",
    regime_tributario: "LR",
    capital_social: 5000000,
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
    regime_tributario: "LP",
    capital_social: 800000,
    porte_empresa: "EPP",
    uf: "MG",
    telefone: "(31) 3200-0002",
    email: "financeiro@betaind.com.br",
    score: 6.2,
    perfil_icp: "generico",
    status_funil: "contato_feito",
    criado_em: daysAgo(30),
    atualizado_em: now,
  },
  {
    cnpj_basico: "11223344",
    razao_social: "Comércio Gama ME",
    regime_tributario: "SN",
    capital_social: 50000,
    porte_empresa: "ME",
    uf: "RJ",
    telefone: "(21) 2500-0003",
    email: "",
    score: 3.1,
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
    regime_tributario: "LR",
    capital_social: 12000000,
    porte_empresa: "GRANDE",
    qtd_filiais: 8,
    uf: "GO",
    telefone: "(62) 3300-0004",
    email: "cfo@agrodelta.com.br",
    score: 9.1,
    transicao_regime: true,
    data_transicao: daysAgo(12),
    perfil_icp: "transicao_regime",
    status_funil: "prospectado",
    criado_em: daysAgo(10),
    atualizado_em: now,
  },
]

async function seedIfEmpty(token) {
  const has = await countMarketLeads(token)
  if (has > 0) {
    console.log("• Base de leads AFS já populada — seed ignorado")
    return
  }
  console.log("• Populando leads de demonstração...")
  for (const lead of sampleLeads) {
    const id = await addDoc(token, "leads", lead)
    console.log("  +", id, lead.razao_social)
  }
  await addDoc(token, "parceiros", {
    nome: "Audit Partners SP",
    rede: "Rede Nacional",
    uf_sede: "SP",
    website: "https://auditpartners.com.br",
    email_contato: "parcerias@auditpartners.com.br",
    telefone: "(11) 4000-1000",
    status_parceria: "ativo",
    criado_em: now,
  })
}

async function main() {
  console.log("AFS Market Intelligence — provisionamento de usuários\n")
  let token = null
  for (const user of AFS_USERS) {
    const t = await ensureUser(user)
    if (t && !token) token = t
  }
  if (token) await seedIfEmpty(token)
  console.log("\nAcesso: /afs-market-intelligence/index.html")
  console.log("Usuários autorizados:", AFS_USERS.map((u) => u.email).join(", "))
}

main().catch((e) => {
  console.error("[AFS-ERROR]", e.message || e)
  process.exit(1)
})
