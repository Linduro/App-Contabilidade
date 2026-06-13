/**
 * Prospecção em Massa — página dedicada com abas:
 * ingestão RF, mapa LR, auditorias, patrimonial, CNAE, priorização cold mail.
 */
import * as store from '../core/store.js';
import { fetchRfStatus, startRfIngest, pollJob, fetchProspectos, mapProspectoToStore } from '../adapters/rf-pipeline-api.js';
import {
  fetchMapaProspectos, fetchCnaeSetores, fetchAuditorias,
  fetchPatrimonial, fetchCarencia,
} from '../adapters/market-intel-api.js';
import { mountBrazilMap, destroyMap } from '../components/brazil-map.js';

const TABS = [
  { id: 'massa', label: 'Ingestão em massa' },
  { id: 'mapa', label: 'Mapa · 230k LR' },
  { id: 'auditorias', label: 'Auditorias' },
  { id: 'patrimonial', label: 'Controle patrimonial' },
  { id: 'cnaes', label: 'CNAE × Setores' },
  { id: 'coldmail', label: 'Priorização cold mail' },
];

let state = {
  tab: 'massa',
  rfBusy: false,
  rfStatus: null,
  mapInstance: null,
  mapUf: '',
  cnaeQ: '',
  cnaeSecao: '',
  auditUf: '',
  patUf: '',
};

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function tabFromHash() {
  const raw = (location.hash || '').split('?')[1] || '';
  const p = new URLSearchParams(raw);
  const t = p.get('tab');
  if (t && TABS.some((x) => x.id === t)) return t;
  return 'massa';
}

function navigateTab(id) {
  state.tab = id;
  location.hash = '#/prospeccao/massa?tab=' + id;
}

function groupsList() {
  return store.list('scrapingGroups').rows;
}

function saveGroup(name, filters) {
  return store.create('scrapingGroups', {
    nome: name,
    filtros: filters,
    status: 'rascunho',
    nota: 'Fila preparada para raspagem futura (sócios, e-mails, filiais)',
  });
}

export async function renderProspeccaoMassa({ mount }) {
  state.tab = tabFromHash();
  if (state.mapInstance) {
    destroyMap(state.mapInstance);
    state.mapInstance = null;
  }

  mount.innerHTML =
    '<div class="pm-page">' +
      heroHtml() +
      '<nav class="l2-subnav pm-tabs">' +
        TABS.map(function (t) {
          return '<a href="#" data-tab="' + t.id + '" class="' + (state.tab === t.id ? 'active' : '') + '">' + t.label + '</a>';
        }).join('') +
      '</nav>' +
      '<div id="pm-tab-body" class="pm-tab-body"></div>' +
    '</div>';

  mount.querySelectorAll('[data-tab]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      navigateTab(a.getAttribute('data-tab'));
    });
  });

  const body = mount.querySelector('#pm-tab-body');
  if (state.tab === 'massa') await renderTabMassa(body, mount);
  else if (state.tab === 'mapa') await renderTabMapa(body);
  else if (state.tab === 'auditorias') await renderTabAuditorias(body);
  else if (state.tab === 'patrimonial') await renderTabPatrimonial(body);
  else if (state.tab === 'cnaes') await renderTabCnaes(body);
  else if (state.tab === 'coldmail') await renderTabColdmail(body);
}

function heroHtml() {
  return (
    '<section class="pm-hero l2-card">' +
      '<div class="pm-hero-grid">' +
        '<div>' +
          '<span class="pm-eyebrow">Comece aqui</span>' +
          '<h2>Prospecção em Massa · Lucro Real</h2>' +
          '<p class="hint">Base Receita Federal (~230 mil empresas). Use a aba <strong>Ingestão em massa</strong> para carregar os dados; depois explore mapas, concorrentes e priorização de cold mail.</p>' +
        '</div>' +
        '<div class="pm-hero-cta">' +
          '<button type="button" id="pm-hero-start" class="btn primary lg">▶ Iniciar ingestão RF</button>' +
          '<a class="btn sm" href="#/prospeccao">Prospecção unitária →</a>' +
        '</div>' +
      '</div>' +
      '<ol class="pm-steps">' +
        '<li><strong>1.</strong> Clique em <em>Iniciar ingestão RF</em> (backend online)</li>' +
        '<li><strong>2.</strong> Aguarde o job (~15 GB download + DuckDB)</li>' +
        '<li><strong>3.</strong> Veja empresas no <em>Mapa</em> e exporte grupos para raspagem</li>' +
      '</ol>' +
    '</section>'
  );
}

async function renderTabMassa(body, mount) {
  state.rfStatus = await fetchRfStatus();
  const u = state.rfStatus?.universo || {};
  const loaded = state.rfStatus?.prospectos_carregados ?? 0;
  const snap = state.rfStatus?.snapshot;

  body.innerHTML =
    '<div class="pm-grid-2">' +
      '<section class="l2-card pm-ingest-card">' +
        '<h3>Ingestão Receita Federal</h3>' +
        '<p class="hint">Pipeline completo: Empresas, Estabelecimentos, Sócios, Simples → filtro Lucro Real.</p>' +
        '<dl class="pm-stats-dl">' +
          '<dt>Prospectos carregados</dt><dd><strong id="pm-loaded">' + loaded.toLocaleString('pt-BR') + '</strong></dd>' +
          '<dt>Universo LR estimado</dt><dd>' + (u.lucro_real ?? '~230.000') + '</dd>' +
          '<dt>Snapshot RF</dt><dd>' + (snap ? esc(snap.versao) + ' · ' + esc(snap.data) : 'Nenhum — rode a ingestão') + '</dd>' +
        '</dl>' +
        '<div class="pm-actions">' +
          '<button type="button" id="pm-rf-start" class="btn primary"' + (state.rfBusy ? ' disabled' : '') + '>Iniciar ingestão completa RF</button>' +
          '<button type="button" id="pm-rf-refresh" class="btn sm">Atualizar status</button>' +
          '<label class="pm-check"><input type="checkbox" id="pm-rf-skip-dl"> Pular download (usar arquivos locais)</label>' +
        '</div>' +
        '<pre id="pm-rf-log" class="pm-log hint">Aguardando ação…</pre>' +
      '</section>' +
      '<section class="l2-card">' +
        '<h3>Informações importantes</h3>' +
        '<ul class="pm-info-list">' +
          '<li><strong>Perfil ICP:</strong> Lucro Real, capital relevante, Agro / Indústria / Varejo (clusters AFS)</li>' +
          '<li><strong>Campos prioritários:</strong> CNPJ, endereço matriz/filiais, sócios, e-mails, CNAE, capital</li>' +
          '<li><strong>Backend:</strong> Cloud Run ou <code>python app.py</code> na porta 5001</li>' +
          '<li><strong>Próximo passo:</strong> grupos selecionados entram na fila de raspagem (sócios, sites, e-mails)</li>' +
        '</ul>' +
      '</section>' +
    '</div>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Grupos para investigação (raspagem futura)</h3>' +
      '<p class="hint">Salve filtros de empresas para enriquecimento em lote quando a fila de scraping estiver ativa.</p>' +
      '<div class="pm-group-form">' +
        '<input type="text" id="pm-group-name" placeholder="Nome do grupo (ex: Agro SP capital &gt; 5M)">' +
        '<select id="pm-group-uf"><option value="">UF (todas)</option>' +
          ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(function(u){ return '<option>'+u+'</option>'; }).join('') +
        '</select>' +
        '<select id="pm-group-cluster"><option value="">Cluster (todos)</option><option>agro</option><option>industria</option><option>varejo</option></select>' +
        '<button type="button" id="pm-group-save" class="btn sm primary">Salvar grupo</button>' +
      '</div>' +
      '<div id="pm-groups-list"></div>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Amostra da base (pós-ingestão)</h3>' +
      '<div id="pm-sample-table"><p class="hint">Carregue a ingestão para ver prospectos.</p></div>' +
    '</section>';

  renderGroupsList(body.querySelector('#pm-groups-list'));

  async function log(msg) {
    const el = body.querySelector('#pm-rf-log');
    if (el) el.textContent = msg;
  }

  async function runIngest(btn) {
    if (state.rfBusy) return;
    state.rfBusy = true;
    if (btn) btn.disabled = true;
    try {
      await log('Iniciando ingestão RF…');
      const skip = body.querySelector('#pm-rf-skip-dl')?.checked;
      const res = await startRfIngest({ skipDownload: skip, modo: 'completo' });
      await log('Job #' + res.job_id + ' — aguardando conclusão…');
      await pollJob(res.job_id, function (j) {
        log('Job #' + res.job_id + ' · ' + (j.status || '') + ' · ' + (j.progress || j.message || ''));
      });
      window.AFSToast?.success('Ingestão RF concluída');
      state.rfStatus = await fetchRfStatus();
      const ld = body.querySelector('#pm-loaded');
      if (ld) ld.textContent = (state.rfStatus?.prospectos_carregados ?? 0).toLocaleString('pt-BR');
      await loadSample();
    } catch (e) {
      await log('Erro: ' + (e.message || e));
      window.AFSToast?.error(e.message || 'Falha na ingestão');
    } finally {
      state.rfBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  mount.querySelector('#pm-hero-start')?.addEventListener('click', function () {
    runIngest(body.querySelector('#pm-rf-start'));
  });
  body.querySelector('#pm-rf-start')?.addEventListener('click', function () {
    runIngest(this);
  });
  body.querySelector('#pm-rf-refresh')?.addEventListener('click', async function () {
    state.rfStatus = await fetchRfStatus();
    renderProspeccaoMassa({ mount });
  });
  body.querySelector('#pm-group-save')?.addEventListener('click', function () {
    const name = body.querySelector('#pm-group-name')?.value.trim();
    if (!name) { window.AFSToast?.warn('Informe o nome do grupo'); return; }
    saveGroup(name, {
      uf: body.querySelector('#pm-group-uf')?.value || null,
      cluster: body.querySelector('#pm-group-cluster')?.value || null,
    });
    body.querySelector('#pm-group-name').value = '';
    renderGroupsList(body.querySelector('#pm-groups-list'));
    window.AFSToast?.success('Grupo salvo para raspagem futura');
  });

  await loadSample();

  async function loadSample() {
    const wrap = body.querySelector('#pm-sample-table');
    if (!wrap) return;
    const data = await fetchProspectos({ limite: 15 });
    if (!data.prospectos?.length) {
      wrap.innerHTML = '<p class="hint">Nenhum prospecto no backend ainda. Inicie a ingestão acima.</p>';
      return;
    }
    wrap.innerHTML =
      '<table class="data-table compact"><thead><tr><th>CNPJ</th><th>Razão social</th><th>UF</th><th>CNAE</th><th>Score</th></tr></thead><tbody>' +
      data.prospectos.map(function (p) {
        return '<tr><td>' + esc(p.cnpj_basico) + '</td><td>' + esc(p.razao_social) + '</td><td>' + esc(p.uf) +
          '</td><td>' + esc(p.cnae) + '</td><td>' + esc(p.score) + '</td></tr>';
      }).join('') +
      '</tbody></table><p class="hint">Total na base: ' + (data.total || 0).toLocaleString('pt-BR') + '</p>';
  }
}

function renderGroupsList(el) {
  const groups = groupsList();
  if (!groups.length) {
    el.innerHTML = '<p class="hint">Nenhum grupo salvo ainda.</p>';
    return;
  }
  el.innerHTML = '<ul class="pm-groups">' + groups.map(function (g) {
    return '<li><strong>' + esc(g.nome) + '</strong> · ' + esc(JSON.stringify(g.filtros)) +
      ' <span class="hint">' + esc(g.status) + '</span></li>';
  }).join('') + '</ul>';
}

async function renderTabMapa(body) {
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Mapa do Brasil · empresas Lucro Real</h3>' +
        '<select id="pm-map-view">' +
          '<option value="heatmap" selected>Mapa de calor (temperatura)</option>' +
          '<option value="points">Nuvem de pontos</option>' +
        '</select>' +
        '<select id="pm-map-metric">' +
          '<option value="volume_lr">Densidade LR</option>' +
          '<option value="share_pct">Participação %</option>' +
        '</select>' +
        '<select id="pm-map-uf"><option value="">Brasil inteiro</option>' +
          ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(function(u){ return '<option>'+u+'</option>'; }).join('') +
        '</select>' +
        '<button type="button" id="pm-map-reload" class="btn sm">Atualizar mapa</button>' +
      '</div>' +
      '<p class="hint" id="pm-map-meta">Carregando…</p>' +
      '<div id="pm-map" class="pm-map pm-map-heat"></div>' +
      '<div id="pm-map-agg" class="pm-agg-grid"></div>' +
    '</section>';

  async function loadMap() {
    const uf = body.querySelector('#pm-map-uf')?.value || '';
    const view = body.querySelector('#pm-map-view')?.value || 'heatmap';
    const metric = body.querySelector('#pm-map-metric')?.value || 'volume_lr';
    const data = await fetchMapaProspectos({ limite: 10000, uf: uf || undefined });
    let agg = data.aggregado_uf || [];
    if (uf) agg = agg.filter(function (a) { return a.uf === uf; });

    body.querySelector('#pm-map-meta').textContent =
      (data.total_empresas || 0).toLocaleString('pt-BR') + ' empresas · fonte: ' + (data.fonte || '—') +
      ' · visualização: ' + (view === 'heatmap' ? 'calor tipo temperatura' : 'nuvem');

    if (state.mapInstance) destroyMap(state.mapInstance);

    if (view === 'heatmap') {
      state.mapInstance = await mountBrazilMap(body.querySelector('#pm-map'), {
        mode: 'heatmap',
        preset: metric,
        aggregado: agg,
        zoom: uf ? 6 : 4,
      });
    } else {
      state.mapInstance = await mountBrazilMap(body.querySelector('#pm-map'), {
        points: data.pontos || [],
        pointStyle: 'empresa',
        zoom: uf ? 6 : 4,
      });
    }

    body.querySelector('#pm-map-agg').innerHTML = agg.slice(0, 12).map(function (a) {
      return '<div class="pm-agg-card"><span>' + a.uf + '</span><strong>' + a.total.toLocaleString('pt-BR') + '</strong><small>' + a.pct + '%</small></div>';
    }).join('');
  }

  body.querySelector('#pm-map-reload')?.addEventListener('click', loadMap);
  body.querySelector('#pm-map-uf')?.addEventListener('change', loadMap);
  body.querySelector('#pm-map-view')?.addEventListener('change', loadMap);
  body.querySelector('#pm-map-metric')?.addEventListener('change', loadMap);
  await loadMap();
}

async function renderTabAuditorias(body) {
  body.innerHTML = '<p class="hint">Carregando inteligência de auditorias…</p>';
  const uf = state.auditUf;
  const data = await fetchAuditorias({ uf: uf || undefined });
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Concorrentes · Bancas de auditoria (Brasil)</h3>' +
        '<select id="pm-audit-uf"><option value="">Todas UFs</option>' +
          ['SP','RJ','MG','RS','PR','SC','BA','PE','GO','DF'].map(function(u){ return '<option'+(uf===u?' selected':'')+'>'+u+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<p class="hint">' + esc(data.nota_ia || '') + '</p>' +
      '<p class="hint">' + (data.total || 0) + ' bancas mapeadas (exclui Big Four + top 10 globais)</p>' +
      '<div id="pm-audit-map" class="pm-map pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>Banca</th><th>UF sede</th><th>Tier</th><th>Faturamento est.</th><th>Raio atuação</th><th>Filiais</th><th>Raspagem</th>' +
      '</tr></thead><tbody id="pm-audit-rows"></tbody></table>' +
    '</section>';

  const rows = body.querySelector('#pm-audit-rows');
  rows.innerHTML = (data.firmas || []).slice(0, 80).map(function (f) {
    const fat = f.faturamento_estimado_m;
    return '<tr><td><strong>' + esc(f.nome) + '</strong><br><small class="hint">' + esc(f.rede) + '</small></td>' +
      '<td>' + esc(f.uf) + '</td><td>' + esc(f.tier) + '</td>' +
      '<td>R$ ' + (fat?.min || '?') + '–' + (fat?.max || '?') + ' mi</td>' +
      '<td>' + (f.raio_atuacao_km || '—') + ' km</td>' +
      '<td>' + (f.filiais?.length || 0) + '</td>' +
      '<td><span class="pm-tag">' + esc(f.scraping_status) + '</span></td></tr>';
  }).join('');

  const circles = (data.firmas || []).map(function (f) {
    return {
      lat: f.sede?.lat,
      lng: f.sede?.lng,
      raio_km: f.raio_atuacao_km,
      color: '#60a5fa',
      label: '<strong>' + esc(f.nome) + '</strong><br>Raio ~' + f.raio_atuacao_km + ' km',
    };
  }).filter(function (c) { return c.lat && c.lng; });

  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-audit-map'), {
    circles: circles.slice(0, 40),
    zoom: 4,
  });

  body.querySelector('#pm-audit-uf')?.addEventListener('change', function () {
    state.auditUf = this.value;
    renderTabAuditorias(body);
  });
}

async function renderTabPatrimonial(body) {
  body.innerHTML = '<p class="hint">Carregando prestadores patrimoniais…</p>';
  const data = await fetchPatrimonial({ uf: state.patUf || undefined });
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Prestadores de controle patrimonial</h3>' +
        '<select id="pm-pat-uf"><option value="">Todas UFs</option>' +
          ['SP','RJ','MG','RS','PR','SC','BA','PE','GO','DF','MT','MS'].map(function(u){
            return '<option' + (state.patUf === u ? ' selected' : '') + '>' + u + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<p class="hint">' + esc(data.nota_ia || '') + '</p>' +
      '<p class="hint">CNAEs-alvo: ' + (data.cnaes_alvo || []).map(function(c){ return c.codigo || c; }).join(', ') + '</p>' +
      '<div id="pm-pat-map" class="pm-map pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>Empresa</th><th>UF</th><th>Serviço</th><th>Tier</th><th>Status dados</th></tr></thead><tbody>' +
      (data.prestadores || []).map(function (p) {
        return '<tr><td><strong>' + esc(p.nome) + '</strong></td><td>' + esc(p.uf) + '</td>' +
          '<td>' + esc(p.tipo_servico) + '</td><td>' + esc(p.tier) + '</td>' +
          '<td><span class="pm-tag">' + esc(p.scraping_status) + '</span></td></tr>';
      }).join('') +
      '</tbody></table>' +
    '</section>';

  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-pat-map'), {
    points: data.pontos_mapa || [],
    pointStyle: 'patrimonial',
    zoom: 4,
  });

  body.querySelector('#pm-pat-uf')?.addEventListener('change', function () {
    state.patUf = this.value;
    renderTabPatrimonial(body);
  });
}

async function renderTabCnaes(body) {
  body.innerHTML = '<p class="hint">Carregando correlação CNAE…</p>';
  const data = await fetchCnaeSetores({ q: state.cnaeQ, secao: state.cnaeSecao });
  const secoes = data.secoes || [];
  body.innerHTML =
    '<section class="l2-card">' +
      '<h3>CNAE × Setores produtivos</h3>' +
      '<p class="hint">' + (data.meta?.descricao || '') + ' · ' + (data.total || data.divisoes?.length || 0) + ' divisões</p>' +
      '<div class="pm-cnae-filters">' +
        '<input type="search" id="pm-cnae-q" placeholder="Buscar código ou setor…" value="' + esc(state.cnaeQ) + '">' +
        '<select id="pm-cnae-secao"><option value="">Todas seções</option>' +
          secoes.map(function (s) {
            return '<option value="' + s.codigo + '"' + (state.cnaeSecao === s.codigo ? ' selected' : '') + '>' +
              s.codigo + ' — ' + esc(s.nome).slice(0, 48) + '</option>';
          }).join('') +
        '</select>' +
        '<button type="button" id="pm-cnae-search" class="btn sm">Filtrar</button>' +
      '</div>' +
      '<div class="pm-secoes-chips">' +
        secoes.map(function (s) {
          return '<span class="pm-chip" title="' + esc(s.nome) + '">' + s.codigo + ' · ' + s.faixa + '</span>';
        }).join('') +
      '</div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>Código</th><th>Divisão CNAE</th><th>Seção</th><th>Setor produtivo</th><th>Cluster AFS</th></tr></thead><tbody>' +
      (data.divisoes || []).map(function (d) {
        return '<tr><td><code>' + esc(d.codigo) + '</code></td><td>' + esc(d.divisao) + '</td>' +
          '<td>' + esc(d.secao) + '</td><td>' + esc(d.setor_produtivo) + '</td>' +
          '<td><span class="pm-tag pm-tag-' + esc(d.cluster_afs) + '">' + esc(d.cluster_afs) + '</span></td></tr>';
      }).join('') +
      '</tbody></table>' +
    '</section>';

  body.querySelector('#pm-cnae-search')?.addEventListener('click', function () {
    state.cnaeQ = body.querySelector('#pm-cnae-q')?.value.trim() || '';
    state.cnaeSecao = body.querySelector('#pm-cnae-secao')?.value || '';
    renderTabCnaes(body);
  });
  body.querySelector('#pm-cnae-q')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') body.querySelector('#pm-cnae-search')?.click();
  });
}

async function renderTabColdmail(body) {
  body.innerHTML = '<p class="hint">Calculando carência regional e prioridade de cold mail…</p>';
  const data = await fetchCarencia();
  body.innerHTML =
    '<section class="l2-card">' +
      '<h3>Priorização cold mail</h3>' +
      '<p class="hint">' + esc(data.metodologia || '') + '</p>' +
      '<div class="pm-cold-top">' +
        '<h4>Top 5 regiões</h4><ol>' +
        (data.top5_cold_mail || []).map(function (r) {
          return '<li><strong>' + r.uf + '</strong> — score ' + r.score_prioridade_cold_mail +
            ' · ' + r.empresas_lr.toLocaleString('pt-BR') + ' LR · carência patrimonial ' + r.carencia_patrimonial_pct + '%</li>';
        }).join('') +
        '</ol></div>' +
      '<div class="pm-map-toolbar">' +
        '<select id="pm-cold-metric">' +
          '<option value="coldmail">Prioridade cold mail</option>' +
          '<option value="carencia">Carência patrimonial</option>' +
        '</select>' +
      '</div>' +
      '<div id="pm-cold-map" class="pm-map pm-map-heat pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>UF</th><th>Empresas LR</th><th>Auditorias</th><th>Prest. patrimonial</th>' +
        '<th>Cobertura audit.</th><th>Carência patrim.</th><th>Score cold mail</th></tr></thead><tbody>' +
      (data.regioes || []).map(function (r) {
        return '<tr><td><strong>' + r.uf + '</strong></td>' +
          '<td>' + r.empresas_lr.toLocaleString('pt-BR') + '</td>' +
          '<td>' + r.auditorias + '</td><td>' + r.prestadores_patrimonial + '</td>' +
          '<td>' + r.cobertura_auditoria_pct + '%</td>' +
          '<td>' + r.carencia_patrimonial_pct + '%</td>' +
          '<td><strong>' + r.score_prioridade_cold_mail + '</strong></td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<p class="hint" style="margin-top:0.75rem">Otimização futura: cruzar empresas selecionadas × cobertura de auditorias × carência de serviços patrimoniais.</p>' +
    '</section>';

  const metric = body.querySelector('#pm-cold-metric')?.value || 'coldmail';
  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-cold-map'), {
    mode: 'heatmap',
    preset: metric,
    aggregado: data.regioes || [],
    zoom: 4,
  });

  body.querySelector('#pm-cold-metric')?.addEventListener('change', async function () {
    if (state.mapInstance) destroyMap(state.mapInstance);
    state.mapInstance = await mountBrazilMap(body.querySelector('#pm-cold-map'), {
      mode: 'heatmap',
      preset: this.value,
      aggregado: data.regioes || [],
      zoom: 4,
    });
  });
}
