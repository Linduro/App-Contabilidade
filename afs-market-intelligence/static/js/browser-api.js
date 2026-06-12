/**
 * AFS Market Intelligence — API compatível (window.AFSMarketAPI) com backend Firestore.
 */
import { db, auth } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  setDoc,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const LEADS = 'leads';
const HISTORICO = 'historico_contato';
const PARCEIROS = 'parceiros';
const CONFIG = 'configuracoes';

let _leadsCache = [];
let _activeFilters = {};

function logError(ctx, err) {
  console.error('[AFS-ERROR]', ctx, err);
  if (err && (err.code === 'permission-denied' || err.code === 'unauthenticated')) {
    if (window.AFSToast) window.AFSToast.error('Sem permissão. Faça login novamente.');
    if (window.AFSAuth && window.AFSAuth.signOut) window.AFSAuth.signOut();
  }
}

function parseQuery(path) {
  const qIdx = path.indexOf('?');
  const base = qIdx >= 0 ? path.slice(0, qIdx) : path;
  const params = {};
  if (qIdx >= 0) {
    new URLSearchParams(path.slice(qIdx + 1)).forEach((v, k) => { params[k] = v; });
  }
  return { base, params };
}

function leadFromDoc(d) {
  const data = d.data();
  return { id: d.id, ...data };
}

function normalizeLead(l) {
  return {
    id: l.id,
    cnpj_basico: l.cnpj_basico || '',
    razao_social: l.razao_social || '—',
    cnae_codigo: l.cnae_codigo || '',
    cnae_descricao: l.cnae_descricao || l.cluster || '',
    regime_tributario: l.regime_tributario || '',
    capital_social: l.capital_social || 0,
    receita_anual_estimada: l.receita_anual_estimada || 0,
    porte_empresa: l.porte_empresa || '',
    qtd_filiais: l.qtd_filiais || 0,
    situacao_cadastral: l.situacao_cadastral || 'ATIVA',
    uf: l.uf || '',
    municipio: l.municipio || '',
    cep: l.cep || '',
    telefone: l.telefone || l.telefone_matriz || '',
    email: l.email || '',
    site: l.site || '',
    linkedin_url: l.linkedin_url || '',
    socios: l.socios || [],
    cluster: l.cluster || l.cluster_estrategico || '—',
    score: l.score || 0,
    transicao_regime: Boolean(l.transicao_regime),
    perfil_icp: l.perfil_icp || 'generico',
    status_funil: l.status_funil || 'prospectado',
    motivo_dead_zone: l.motivo_dead_zone || l.motivo || '',
    rota_recomendada: l.rota_recomendada || '',
    prioridade: l.prioridade || 'Média',
    data_transicao: l.data_transicao || null,
    criado_em: l.criado_em,
    atualizado_em: l.atualizado_em,
  };
}

function applyClientFilters(leads, params) {
  let list = leads.map(normalizeLead);
  const perfil = params.perfil;
  if (perfil) list = list.filter((l) => !l.perfil_icp || l.perfil_icp === perfil || perfil === 'generico');

  if (params.uf && params.uf !== 'Todos') list = list.filter((l) => l.uf === params.uf);
  if (params.regime && params.regime !== 'Todos') {
    const map = { 'Simples Nacional': 'SN', 'Lucro Presumido': 'LP', 'Lucro Real': 'LR' };
    const code = map[params.regime] || params.regime;
    list = list.filter((l) => l.regime_tributario === code);
  }
  if (params.porte && params.porte !== 'Todos') list = list.filter((l) => l.porte_empresa === params.porte);
  if (params.cnae && params.cnae !== 'Todos') list = list.filter((l) => l.cnae_codigo === params.cnae || l.cnae_descricao === params.cnae);
  if (params.capital_min) list = list.filter((l) => l.capital_social >= Number(params.capital_min));
  if (params.capital_max) list = list.filter((l) => l.capital_social <= Number(params.capital_max));
  if (params.score_min) list = list.filter((l) => l.score >= Number(params.score_min));
  if (params.transicao === 'true') list = list.filter((l) => l.transicao_regime);
  if (params.email_validado === 'true') list = list.filter((l) => l.email && l.email.includes('@'));
  if (params.situacao_ativa === 'true') list = list.filter((l) => l.situacao_cadastral === 'ATIVA');
  if (params.q) {
    const q = params.q.toLowerCase();
    list = list.filter((l) => l.razao_social.toLowerCase().includes(q) || l.cnpj_basico.includes(q));
  }
  if (params.status_funil) list = list.filter((l) => l.status_funil === params.status_funil);

  const lim = params.limite ? parseInt(params.limite, 10) : 500;
  return list.slice(0, lim);
}

function isAfsMarketLead(data) {
  return Boolean(data && (data.cnpj_basico || data.perfil_icp || data.regime_tributario));
}

async function fetchAllLeads() {
  const snap = await getDocs(collection(db, LEADS));
  _leadsCache = snap.docs.filter((d) => isAfsMarketLead(d.data())).map(leadFromDoc);
  return _leadsCache;
}

async function getLeads(params) {
  _activeFilters = params;
  if (!_leadsCache.length) await fetchAllLeads();
  const leads = applyClientFilters(_leadsCache, params);
  return { leads, total: leads.length };
}

async function getStatus(params) {
  if (!_leadsCache.length) await fetchAllLeads();
  const perfil = params.perfil || 'generico';
  const leads = applyClientFilters(_leadsCache, { perfil });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const countInMonth = (arr, start, end) =>
    arr.filter((l) => {
      const ts = l.criado_em && l.criado_em.toDate ? l.criado_em.toDate() : null;
      return ts && ts >= start && ts < end;
    }).length;

  const total = leads.length;
  const enriched = leads.filter((l) => l.email).length;
  const validated = leads.filter((l) => l.email && l.email.includes('@')).length;
  const deadZone = leads.filter((l) => l.status_funil === 'dead_zone').length;
  const transicao = leads.filter((l) => l.transicao_regime).length;
  const fechados = leads.filter((l) => l.status_funil === 'fechado').length;
  const prospectados = leads.filter((l) => l.status_funil === 'prospectado').length;

  const thisMonth = countInMonth(leads, monthStart, now);
  const lastMonth = countInMonth(leads, prevStart, monthStart);
  const pctChange = lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const regimeCounts = { SN: 0, LP: 0, LR: 0 };
  leads.forEach((l) => { if (regimeCounts[l.regime_tributario] !== undefined) regimeCounts[l.regime_tributario]++; });

  let configDoc = {};
  try {
    const c = await getDoc(doc(db, CONFIG, 'status'));
    if (c.exists()) configDoc = c.data();
  } catch (e) { logError('getStatus/config', e); }

  return {
    perfil_ativo: perfil,
    online: true,
    funil: {
      universo_icp: total,
      enriquecidos: enriched,
      emails_validados: validated,
      dead_zone: deadZone,
      transicao_regime: transicao,
      taxa_conversao: prospectados ? (fechados / prospectados) * 100 : 0,
      pct_change: pctChange,
      regime_counts: regimeCounts,
    },
    ...configDoc,
  };
}

async function getDeadZone(params) {
  const data = await getLeads({ ...params, status_funil: 'dead_zone', limite: params.limite || 100 });
  return {
    dead_zone: data.leads.map((l) => ({
      razao_social: l.razao_social,
      cluster_estrategico: l.cluster,
      motivo: l.motivo_dead_zone,
      rota_recomendada: l.rota_recomendada,
      linkedin_url: l.linkedin_url,
      telefone_matriz: l.telefone,
      prioridade: l.prioridade,
      id: l.id,
    })),
  };
}

async function getTransicao() {
  const data = await getLeads({ transicao: 'true', limite: 200 });
  const last90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recent = data.leads.filter((l) => {
    if (!l.data_transicao) return true;
    const d = l.data_transicao.toDate ? l.data_transicao.toDate() : new Date(l.data_transicao);
    return d.getTime() >= last90;
  });
  return {
    count_90d: recent.length,
    transicoes: data.leads.map((l) => ({
      id: l.id,
      cnpj_basico: l.cnpj_basico,
      razao_social: l.razao_social,
      regime_anterior: 'SN',
      regime_novo: l.regime_tributario || 'LR',
      cluster_estrategico: l.cluster,
      score_prioridade: l.score,
      uf: l.uf,
      capital_social: l.capital_social,
      telefone: l.telefone,
      email: l.email,
      data_transicao: l.data_transicao,
    })),
  };
}

async function getParceiros() {
  const snap = await getDocs(collection(db, PARCEIROS));
  return { parceiros: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

async function postFeedback(body) {
  const leadId = String(body.lead_id || body.leadId);
  await addDoc(collection(db, HISTORICO), {
    lead_id: leadId,
    outcome: body.outcome,
    motivo: body.motivo || '',
    responsavel: auth.currentUser?.email || 'sistema',
    data_contato: serverTimestamp(),
  });
  const updates = { atualizado_em: serverTimestamp() };
  if (body.outcome === 'reativado') {
    updates.status_funil = 'prospectado';
    updates.motivo_dead_zone = '';
  } else if (body.status_funil) {
    updates.status_funil = body.status_funil;
  }
  await updateDoc(doc(db, LEADS, leadId), updates);
  const idx = _leadsCache.findIndex((l) => l.id === leadId);
  if (idx >= 0) Object.assign(_leadsCache[idx], updates);
  return { status: 'ok' };
}

async function postExport(body) {
  const data = await getLeads({ perfil: body.perfil, limite: 5000 });
  const dead = await getDeadZone({ limite: 5000 });
  const trans = await getTransicao();
  const parc = await getParceiros();
  const histSnap = await getDocs(collection(db, HISTORICO));
  return {
    status: 'ok',
    filename: 'afs-export-' + Date.now() + '.xlsx',
    sheets: {
      leads: data.leads,
      dead_zone: dead.dead_zone,
      transicao: trans.transicoes,
      parceiros: parc.parceiros,
      historico: histSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    },
    perfil: body.perfil,
  };
}

async function postPipeline(body) {
  const ref = doc(db, CONFIG, 'pipeline');
  const steps = ['ingestao_rf', 'icp_cluster', 'enriquecimento', 'validacao_email', 'monitor_regime'];
  const state = {
    config: body,
    steps: steps.map((s, i) => ({
      id: s,
      status: i === 0 ? 'running' : 'pending',
      started_at: i === 0 ? new Date().toISOString() : null,
      ended_at: null,
      processed: 0,
      total: 100,
    })),
    updated_at: serverTimestamp(),
  };
  try {
    await updateDoc(ref, state);
  } catch {
    await setDoc(ref, state);
  }
  return { status: 'ok', message: 'Pipeline iniciado', steps: state.steps };
}

async function getHistorico(leadId) {
  const q = query(collection(db, HISTORICO), where('lead_id', '==', leadId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
    const ta = a.data_contato?.toMillis?.() || 0;
    const tb = b.data_contato?.toMillis?.() || 0;
    return tb - ta;
  });
}

async function routeGet(path) {
  const { base, params } = parseQuery(path);
  try {
    if (base === '/status') return getStatus(params);
    if (base === '/leads') return getLeads(params);
    if (base === '/dead-zone') return getDeadZone(params);
    if (base === '/transicao-regime') return getTransicao();
    if (base === '/parceiros') return getParceiros();
    if (base.startsWith('/historico/')) return { items: await getHistorico(base.split('/').pop()) };
    if (base === '/config/scoring') {
      const c = await getDoc(doc(db, CONFIG, 'scoring'));
      return c.exists() ? c.data() : { pesos_scoring: { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 } };
    }
    if (base === '/config/pipeline') {
      const c = await getDoc(doc(db, CONFIG, 'pipeline'));
      return c.exists() ? c.data() : { config: {} };
    }
    return { error: 'not_found', path: base };
  } catch (e) {
    logError('GET ' + path, e);
    throw e;
  }
}

async function routePost(path, body) {
  const base = path.indexOf('?') >= 0 ? path.slice(0, path.indexOf('?')) : path;
  try {
    if (base === '/feedback') return postFeedback(body);
    if (base === '/export') return postExport(body);
    if (base === '/pipeline/run') return postPipeline(body);
    if (base === '/parceiros') {
      const ref = await addDoc(collection(db, PARCEIROS), {
        ...body,
        criado_em: serverTimestamp(),
        status_parceria: body.status_parceria || 'prospectando',
      });
      return { status: 'ok', id: ref.id };
    }
    if (base === '/config/scoring') {
      try {
        await updateDoc(doc(db, CONFIG, 'scoring'), { pesos_scoring: body.pesos, updated_at: serverTimestamp() });
      } catch {
        await setDoc(doc(db, CONFIG, 'scoring'), { pesos_scoring: body.pesos });
      }
      return { status: 'ok' };
    }
    if (base === '/leads/recalculate-scores') {
      const pesos = body.pesos || { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 };
      if (!_leadsCache.length) await fetchAllLeads();
      const batch = writeBatch(db);
      let n = 0;
      _leadsCache.forEach((l) => {
        const score = Math.min(10,
          (l.capital_social ? Math.log10(l.capital_social + 1) : 0) * (pesos.capital / 5) +
          (l.qtd_filiais || 0) * 0.3 * (pesos.filiais / 5) +
          (l.transicao_regime ? 2 : 0) * (pesos.regime / 5),
        );
        batch.update(doc(db, LEADS, l.id), { score: Math.round(score * 10) / 10 });
        n++;
        if (n >= 500) return;
      });
      await batch.commit();
      _leadsCache = [];
      return { status: 'ok', updated: n };
    }
    return { error: 'not_found', path: base };
  } catch (e) {
    logError('POST ' + path, e);
    throw e;
  }
}

function apiBase() {
  if (typeof window.__AFS_MARKET_API_BASE__ === 'string' && window.__AFS_MARKET_API_BASE__) {
    return window.__AFS_MARKET_API_BASE__.replace(/\/$/, '');
  }
  return 'firestore://';
}

window.AFSMarketAPI = {
  base: apiBase,
  get: routeGet,
  post: routePost,
  invalidateCache: function () { _leadsCache = []; },
  subscribeLeads: function (cb) {
    return onSnapshot(collection(db, LEADS), function (snap) {
      _leadsCache = snap.docs.filter((d) => isAfsMarketLead(d.data())).map(leadFromDoc);
      cb(_leadsCache);
    }, function (e) { logError('subscribeLeads', e); });
  },
  subscribeConfigStatus: function (cb) {
    return onSnapshot(doc(db, CONFIG, 'status'), function (d) {
      cb(d.exists() ? d.data() : { online: true });
    }, function () { cb({ online: false }); });
  },
  getHistorico: getHistorico,
  updateLead: async function (id, data) {
    await updateDoc(doc(db, LEADS, id), { ...data, atualizado_em: serverTimestamp() });
    const idx = _leadsCache.findIndex((l) => l.id === id);
    if (idx >= 0) Object.assign(_leadsCache[idx], data);
  },
  searchLeads: async function (term) {
    if (!_leadsCache.length) await fetchAllLeads();
    const q = term.toLowerCase().trim();
    if (!q) return [];
    return _leadsCache
      .filter((l) => l.razao_social?.toLowerCase().includes(q) || l.cnpj_basico?.includes(q))
      .slice(0, 8)
      .map(normalizeLead);
  },
};
