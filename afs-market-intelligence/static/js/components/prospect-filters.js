/**
 * Filtros ICP compartilhados — capital, CNAE, porte (proxy funcionários), região.
 */

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export function defaultFilters() {
  const cfg = window.__AFS_PROSPECT_DEFAULTS__ || {};
  return {
    capitalMin: cfg.capital_min ?? 2000000,
    capitalMax: cfg.capital_max ?? 10000000,
    cnae: '',
    porte: '',
    uf: '',
    cluster: '',
    municipio: '',
    q: '',
    excluirFrios: true,
    apenasQuentes: false,
    cnaeStatus: '',
  };
}

export function filtersToQuery(f) {
  const q = new URLSearchParams();
  if (f.uf) q.set('uf', f.uf);
  if (f.cluster) q.set('cluster', f.cluster);
  if (f.cnae) q.set('cnae', f.cnae);
  if (f.porte) q.set('porte', f.porte);
  if (f.municipio) q.set('municipio', f.municipio);
  if (f.q) q.set('q', f.q);
  if (f.capitalMin != null && f.capitalMin !== '') q.set('capital_min', String(f.capitalMin));
  if (f.capitalMax != null && f.capitalMax !== '') q.set('capital_max', String(f.capitalMax));
  if (f.excluirFrios) q.set('excluir_frios', 'true');
  if (f.apenasQuentes) q.set('apenas_quentes', 'true');
  if (f.cnaeStatus) q.set('cnae_status', f.cnaeStatus);
  return q;
}

export function readFiltersFromDom(root, prefix) {
  prefix = prefix || 'pm-f';
  const g = (id) => root.querySelector('#' + prefix + '-' + id);
  return {
    capitalMin: g('capital-min')?.value !== '' ? Number(g('capital-min')?.value) : '',
    capitalMax: g('capital-max')?.value !== '' ? Number(g('capital-max')?.value) : '',
    cnae: g('cnae')?.value.trim() || '',
    porte: g('porte')?.value || '',
    uf: g('uf')?.value || '',
    cluster: g('cluster')?.value || '',
    municipio: g('municipio')?.value.trim() || '',
    q: g('q')?.value.trim() || '',
    excluirFrios: !!g('excluir-frios')?.checked,
    apenasQuentes: !!g('apenas-quentes')?.checked,
    cnaeStatus: g('cnae-status')?.value || '',
  };
}

export function renderFilterBar(prefix, filters, opts) {
  opts = opts || {};
  const capMin = filters.capitalMin ?? 2000000;
  const capMax = filters.capitalMax ?? 10000000;
  return (
    '<div class="pm-filter-bar l2-card">' +
      '<div class="pm-filter-head">' +
        '<h4>Filtros ICP</h4>' +
        (opts.count != null ? '<span class="pm-filter-count">' + opts.count.toLocaleString('pt-BR') + ' empresas</span>' : '') +
      '</div>' +
      '<div class="pm-filter-grid">' +
        '<label class="l2-field"><span>Capital mín. (R$)</span>' +
          '<input type="number" id="' + prefix + '-capital-min" value="' + capMin + '" step="100000"></label>' +
        '<label class="l2-field"><span>Capital máx. (R$)</span>' +
          '<input type="number" id="' + prefix + '-capital-max" value="' + capMax + '" step="100000"></label>' +
        '<label class="l2-field"><span>CNAE (prefixo)</span>' +
          '<input type="text" id="' + prefix + '-cnae" placeholder="ex: 10 ou 4711" value="' + (filters.cnae || '') + '"></label>' +
        '<label class="l2-field"><span>Porte → funcionários</span>' +
          '<select id="' + prefix + '-porte" class="l2-select">' +
            '<option value="">Todos</option>' +
            '<option value="01"' + (filters.porte === '01' ? ' selected' : '') + '>Micro (0–9)</option>' +
            '<option value="03"' + (filters.porte === '03' ? ' selected' : '') + '>EPP (10–49)</option>' +
            '<option value="05"' + (filters.porte === '05' ? ' selected' : '') + '>Demais (50+)</option>' +
          '</select></label>' +
        '<label class="l2-field"><span>UF</span><select id="' + prefix + '-uf" class="l2-select">' +
          '<option value="">Todas</option>' +
          UFS.map(function (u) {
            return '<option' + (filters.uf === u ? ' selected' : '') + '>' + u + '</option>';
          }).join('') +
        '</select></label>' +
        '<label class="l2-field"><span>Cluster</span><select id="' + prefix + '-cluster" class="l2-select">' +
          '<option value="">Todos</option>' +
          ['agro','industria','varejo'].map(function (c) {
            return '<option' + (filters.cluster === c ? ' selected' : '') + '>' + c + '</option>';
          }).join('') +
        '</select></label>' +
        '<label class="l2-field"><span>Município</span>' +
          '<input type="text" id="' + prefix + '-municipio" placeholder="Nome ou código IBGE" value="' + (filters.municipio || '') + '"></label>' +
        '<label class="l2-field"><span>Busca</span>' +
          '<input type="text" id="' + prefix + '-q" placeholder="Razão social ou CNPJ" value="' + (filters.q || '') + '"></label>' +
        '<label class="l2-field pm-check-field"><span>CNAE classificação</span>' +
          '<select id="' + prefix + '-cnae-status" class="l2-select">' +
            '<option value="">Todas (exc. frios se marcado)</option>' +
            '<option value="quente"' + (filters.cnaeStatus === 'quente' ? ' selected' : '') + '>Só quentes</option>' +
            '<option value="neutro"' + (filters.cnaeStatus === 'neutro' ? ' selected' : '') + '>Só neutros</option>' +
            '<option value="frio"' + (filters.cnaeStatus === 'frio' ? ' selected' : '') + '>Só frios (debug)</option>' +
          '</select></label>' +
      '</div>' +
      '<div class="pm-filter-checks">' +
        '<label class="pm-check"><input type="checkbox" id="' + prefix + '-excluir-frios"' + (filters.excluirFrios !== false ? ' checked' : '') + '> Excluir CNAEs frios (blacklist)</label>' +
        '<label class="pm-check"><input type="checkbox" id="' + prefix + '-apenas-quentes"' + (filters.apenasQuentes ? ' checked' : '') + '> Apenas CNAEs quentes (Cluster AFS)</label>' +
      '</div>' +
      '<div class="pm-filter-actions">' +
        '<button type="button" class="btn sm primary" id="' + prefix + '-apply">Aplicar filtros</button>' +
        '<button type="button" class="btn sm" id="' + prefix + '-reset">ICP padrão (R$ 2–10 mi)</button>' +
      '</div>' +
      '<p class="hint pm-filter-hint">RF não informa nº exato de funcionários — porte é proxy. Localização no mapa por município (coord. aproximadas).</p>' +
    '</div>'
  );
}

export function bindFilterBar(root, prefix, onApply, getFilters, setFilters) {
  root.querySelector('#' + prefix + '-apply')?.addEventListener('click', function () {
    setFilters(readFiltersFromDom(root, prefix));
    onApply();
  });
  root.querySelector('#' + prefix + '-reset')?.addEventListener('click', function () {
    setFilters(defaultFilters());
    onApply();
  });
}

export function formatCapital(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR');
}
