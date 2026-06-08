const { createClient } = require("@supabase/supabase-js")
const functions = require("firebase-functions")

const OWNER_EMAIL = String.fromCharCode(
  99, 97, 114, 116, 111, 111, 110, 104, 113, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109,
)

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.LICITACOES_SUPABASE_URL ||
    functions.config().licitacoes?.supabase_url

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LICITACOES_SUPABASE_SERVICE_ROLE_KEY ||
    functions.config().licitacoes?.service_role_key

  if (!url || !key) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Supabase não configurado nas Firebase Functions.",
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function assertOwner(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login necessário.")
  }

  const email = context.auth.token.email?.toLowerCase().trim()
  if (email !== OWNER_EMAIL) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Acesso restrito ao proprietário.",
    )
  }

  return email
}

function startOfCurrentMonth() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

async function getAdvogadoByEmail(supabase, email) {
  const { data, error } = await supabase
    .from("advogados")
    .select("id, nome, email, ativo")
    .eq("email", email)
    .maybeSingle()

  if (error) throw error
  return data
}

async function handleGetDashboard(supabase, email) {
  const advogado = await getAdvogadoByEmail(supabase, email)
  if (!advogado?.ativo) {
    return {
      advogado: null,
      matches: [],
      especialidades: [],
      stats: { abertasMes: 0, inscricoesMes: 0 },
    }
  }

  const monthStart = startOfCurrentMonth()

  const [matchesRes, espRes, abertasRes, inscricoesRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `
        id,
        licitacao_id,
        advogado_id,
        especialidade_id,
        relevancia_score,
        motivo,
        status,
        notificado,
        visto_em,
        inscrito_em,
        arquivado_em,
        created_at,
        licitacao:licitacoes(*),
        especialidade:especialidades_advogados(*)
      `,
      )
      .eq("advogado_id", advogado.id)
      .neq("status", "arquivado")
      .order("relevancia_score", { ascending: false }),

    supabase
      .from("advogados_especialidades")
      .select(
        `
        especialidade_id,
        nivel_experiencia,
        especialidade:especialidades_advogados(*)
      `,
      )
      .eq("advogado_id", advogado.id),

    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("advogado_id", advogado.id)
      .neq("status", "arquivado")
      .gte("created_at", monthStart),

    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("advogado_id", advogado.id)
      .eq("status", "inscrito")
      .gte("inscrito_em", monthStart),
  ])

  if (matchesRes.error) throw matchesRes.error
  if (espRes.error) throw espRes.error
  if (abertasRes.error) throw abertasRes.error
  if (inscricoesRes.error) throw inscricoesRes.error

  return {
    advogado,
    matches: matchesRes.data ?? [],
    especialidades: espRes.data ?? [],
    stats: {
      abertasMes: abertasRes.count ?? 0,
      inscricoesMes: inscricoesRes.count ?? 0,
    },
  }
}

async function handleUpdateMatchStatus(supabase, email, matchId, status) {
  const advogado = await getAdvogadoByEmail(supabase, email)
  if (!advogado) {
    throw new functions.https.HttpsError("not-found", "Advogado não encontrado.")
  }

  const payload = { status }
  const now = new Date().toISOString()
  if (status === "visto") payload.visto_em = now
  if (status === "inscrito") payload.inscrito_em = now
  if (status === "arquivado") payload.arquivado_em = now

  const { error } = await supabase
    .from("matches")
    .update(payload)
    .eq("id", matchId)
    .eq("advogado_id", advogado.id)

  if (error) throw error
  return { ok: true }
}

async function licitacoesApiHandler(data, context) {
  const email = assertOwner(context)
  const supabase = getSupabaseAdmin()
  const { action, matchId, status } = data || {}

  if (action === "getDashboard") {
    return handleGetDashboard(supabase, email)
  }

  if (action === "updateMatchStatus") {
    if (!matchId || !status) {
      throw new functions.https.HttpsError("invalid-argument", "matchId e status são obrigatórios.")
    }
    return handleUpdateMatchStatus(supabase, email, matchId, status)
  }

  throw new functions.https.HttpsError("invalid-argument", "Ação inválida.")
}

module.exports = { licitacoesApiHandler, OWNER_EMAIL }
