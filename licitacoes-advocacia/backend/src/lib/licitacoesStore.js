import { getFirestoreAdmin, isFirestoreAdminConfigured } from "./firestoreAdmin.js";

const COL = {
  config: "licitacoesConfig",
  especialidades: "licitacoesEspecialidades",
  licitacoes: "licitacoes",
  matches: "licitacoesMatches",
};

function catalogDocToEspecialidade(id, data) {
  return {
    id,
    nome: data.nome,
    slug: data.slug ?? id,
    descricao: data.descricao ?? null,
    palavras_chave: data.palavras_chave ?? [],
    ativo: data.ativo !== false,
  };
}

export function isLicitacoesStoreConfigured() {
  return isFirestoreAdminConfigured();
}

export async function hashExists(hash) {
  const db = getFirestoreAdmin();
  const snap = await db
    .collection(COL.licitacoes)
    .where("hash_conteudo", "==", hash)
    .limit(1)
    .get();

  return !snap.empty;
}

export async function loadEspecialidadesBySlug() {
  const db = getFirestoreAdmin();
  const snap = await db.collection(COL.especialidades).get();
  const map = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.ativo === false) continue;
    map.set(data.slug ?? doc.id, doc.id);
  }

  return map;
}

export async function getAdvogadosByEspecialidade(especialidadeId) {
  const db = getFirestoreAdmin();
  const ownerSnap = await db.collection(COL.config).doc("owner").get();
  if (!ownerSnap.exists) return [];

  const owner = ownerSnap.data();
  if (owner.ativo === false) return [];

  const hasEsp = (owner.especialidades ?? []).some(
    (item) => item.slug === especialidadeId,
  );
  if (!hasEsp) return [];

  return [
    {
      id: owner.id ?? "owner",
      nome: owner.nome,
      email: owner.email,
      ativo: true,
    },
  ];
}

export async function insertLicitacao(licitacao) {
  const db = getFirestoreAdmin();
  const now = new Date().toISOString();
  const payload = {
    ...licitacao,
    created_at: now,
    updated_at: now,
  };

  const ref = await db.collection(COL.licitacoes).add(payload);
  return { id: ref.id, ...payload };
}

export async function createMatch({
  licitacaoId,
  advogadoId,
  especialidadeId,
  relevanciaScore,
  motivo,
}) {
  const db = getFirestoreAdmin();

  const duplicate = await db
    .collection(COL.matches)
    .where("licitacao_id", "==", licitacaoId)
    .where("advogado_id", "==", advogadoId)
    .limit(1)
    .get();

  if (!duplicate.empty) return false;

  const [licSnap, espSnap] = await Promise.all([
    db.collection(COL.licitacoes).doc(licitacaoId).get(),
    db.collection(COL.especialidades).doc(especialidadeId).get(),
  ]);

  if (!licSnap.exists || !espSnap.exists) return false;

  const licitacao = { id: licSnap.id, ...licSnap.data() };
  const especialidade = catalogDocToEspecialidade(espSnap.id, espSnap.data());
  const now = new Date().toISOString();

  await db.collection(COL.matches).add({
    licitacao_id: licitacaoId,
    advogado_id: advogadoId,
    especialidade_id: especialidadeId,
    relevancia_score: relevanciaScore,
    motivo,
    status: "novo",
    notificado: false,
    visto_em: null,
    inscrito_em: null,
    arquivado_em: null,
    created_at: now,
    licitacao,
    especialidade,
  });

  return true;
}

export async function getUnnotifiedMatches() {
  const db = getFirestoreAdmin();
  const [snap, ownerSnap] = await Promise.all([
    db.collection(COL.matches).where("notificado", "==", false).get(),
    db.collection(COL.config).doc("owner").get(),
  ]);

  const owner = ownerSnap.exists ? ownerSnap.data() : null;
  const advogado = owner
    ? {
        id: owner.id ?? "owner",
        nome: owner.nome,
        email: owner.email,
        ativo: owner.ativo !== false,
      }
    : null;

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      advogado:
        advogado && data.advogado_id === advogado.id ? advogado : data.advogado,
    };
  });
}

export async function markMatchesNotified(matchIds) {
  if (matchIds.length === 0) return;

  const db = getFirestoreAdmin();
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const id of matchIds) {
    batch.update(db.collection(COL.matches).doc(id), {
      notificado: true,
      notificado_em: now,
    });
  }

  await batch.commit();
}
