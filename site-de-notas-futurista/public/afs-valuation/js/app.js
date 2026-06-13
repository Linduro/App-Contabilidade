// ============================================================
// Asset Solutions Valuation — Frontend Logic
// static/js/app.js
// ============================================================

function sanitizeApiBase(base) {
    const b = String(base || '').trim().replace(/\/$/, '');
    if (!b) return '';
    if (/\/afs-api$/i.test(b) || /github\.io\/.*afs-api/i.test(b)) return '';
    if (b.startsWith('/') && typeof window !== 'undefined' && /github\.io$/i.test(window.location.hostname)) {
        return '';
    }
    return b;
}

function getAfsApiBase() {
    if (typeof window !== 'undefined' && window.__AFS_API_BASE__ != null) {
        return sanitizeApiBase(window.__AFS_API_BASE__);
    }
    return '';
}

function apiUrl(path) {
    const base = getAfsApiBase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
}

function hasRemoteApi() {
    const base = getAfsApiBase();
    return Boolean(base && base.trim());
}

/** GitHub Pages não tem backend Flask — export/API de arquivo é sempre no navegador */
function isGitHubPagesHost() {
    return typeof window !== 'undefined' && /github\.io$/i.test(window.location.hostname || '');
}

function useBrowserSpreadsheetExport() {
    return !hasRemoteApi() || isGitHubPagesHost();
}

async function loadApiConfig() {
    try {
        const configPath = window.location.pathname.replace(/\/[^/]*$/, '/config.json');
        const res = await fetch(`${configPath}?t=${Date.now()}`);
        if (!res.ok) {
            window.__AFS_API_BASE__ = '';
            return;
        }
        const cfg = await res.json();
        if (cfg.apiBase && String(cfg.apiBase).trim()) {
            window.__AFS_API_BASE__ = sanitizeApiBase(cfg.apiBase);
        } else {
            window.__AFS_API_BASE__ = '';
        }
    } catch (e) {
        window.__AFS_API_BASE__ = '';
        console.warn('Config API não carregada — modo navegador:', e);
    }
    updateApiModeBadge();
}

function updateApiModeBadge() {
    const textEl = document.getElementById('statusText');
    const dotEl = document.getElementById('statusDot');
    if (!textEl) return;
    if (!hasRemoteApi()) {
        textEl.textContent = 'Modo navegador (sem servidor)';
        dotEl?.classList.add('active');
        return;
    }
    textEl.textContent = 'API remota conectada';
}

async function apiFetch(path, options = {}) {
    if (!hasRemoteApi()) {
        if (typeof browserApiFetch === 'function') {
            return browserApiFetch(path, options);
        }
        throw new Error('Modo navegador indisponível');
    }
    const res = await fetch(apiUrl(path), options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const preview = (await res.text()).slice(0, 80);
        if (preview.trimStart().startsWith('<')) {
            throw new Error(
                'Servidor da API indisponível. Recarregue com Ctrl+Shift+R. Sem backend, o app funciona em modo navegador (apiBase vazio).'
            );
        }
        throw new Error('Resposta inválida do servidor');
    }
    const data = await res.json();
    if (!res.ok && data.message) {
        throw new Error(data.message);
    }
    return data;
}

function downloadFileUrl(path) {
    return apiUrl(path);
}

// ---------- State ----------
const state = {
    hasApiKey: false,
    hasSpreadsheet: false,
    hasMappings: false,
    initialized: false,
    spreadsheetHeaders: [],
    spreadsheetData: null,
};

let currentSideRow = null;
let currentReviewRow = null;

function resolveRowPhotosForDisplay(row, mappings, spreadsheetMeta) {
    const lookups = spreadsheetMeta?.photo_lookups || {
        bem: spreadsheetMeta?.photo_lookup || {},
        spec: {},
        tag: {}
    };
    if (typeof afsCollectPhotosForRow === 'function') {
        const photos = afsCollectPhotosForRow(
            row,
            mappings,
            lookups,
            spreadsheetMeta?.headers || []
        );
        if (photos.length) return photos;
        if (typeof afsDebugPhotoResolution === 'function' && window.__AFS_PHOTO_DEBUG) {
            console.warn('[AFS Foto Debug]', afsDebugPhotoResolution(row, mappings, lookups, spreadsheetMeta?.headers));
        }
    }
    const letters = [
        { letter: mappings.photo_original, type: 'Foto do Bem' },
        { letter: mappings.photo_spec, type: 'Foto Especificações' },
        { letter: mappings.photo_tag, type: 'Foto da TAG' }
    ];
    const photos = [];
    for (const { letter, type } of letters) {
        const url = letter ? normalizePhotoUrl(row[letter]) : null;
        if (isValidPhotoUrl(url)) photos.push({ url, type });
    }
    return photos;
}

function isValidPhotoUrl(url) {
    const normalized = typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(url) : url;
    if (!normalized || typeof normalized !== 'string') return false;
    const u = normalized.trim().toLowerCase();
    if (!u || u.includes('sem foto') || u.includes('sem imagem') ||
        u.includes('indisponivel') || u.includes('indisponível')) return false;
    return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//');
}

/** Fotos persistidas na avaliação (independente da planilha) */
function photosFromEvaluation(ev) {
    if (!ev) return [];
    if (ev.photos && Array.isArray(ev.photos)) {
        return ev.photos
            .map(p => ({
                url: typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(p.url) : p.url,
                type: p.type || p.category || 'Foto'
            }))
            .filter(p => isValidPhotoUrl(p.url));
    }
    const list = [];
    const add = (url, type) => {
        const u = typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(url) : url;
        if (isValidPhotoUrl(u)) list.push({ url: u, type });
    };
    add(ev.photo_url, 'Foto do Bem');
    add(ev.photo_spec, 'Foto Especificações');
    add(ev.photo_tag, 'Foto da TAG');
    return list;
}

function getActiveSpreadsheetName() {
    return state.spreadsheetData?.file_name || '';
}

function formatControlLabel(controlVal, rowIdx) {
    if (controlVal !== null && controlVal !== undefined && String(controlVal).trim() !== '') {
        return String(controlVal).trim();
    }
    return rowIdx != null ? `— (${rowIdx})` : '—';
}

function evalRowId(rowIdx, controlVal) {
    const ctrl = controlVal != null && String(controlVal).trim() !== '' ? String(controlVal).trim() : '';
    return ctrl ? `eval_ctrl_${ctrl.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `eval_row_${rowIdx}`;
}

function formatConservationLabel(value) {
    if (value === null || value === undefined || value === '') return '-';
    const labels = {
        5: '5 — Novo na caixa',
        4: '4 — Seminovo / open box',
        3: '3 — Conservação esperada para a idade',
        2: '2 — Abaixo do esperado / precisa reparo',
        1: '1 — Sucata / abandonado'
    };
    const num = parseInt(value, 10);
    return labels[num] || String(value);
}

function formatEvaluationLinksHtml(evOrData) {
    const d = evOrData || {};
    const urls = (d.links_array && d.links_array.length)
        ? d.links_array
        : (d.links ? String(d.links).split(',') : (d.valuation?.links_comparativos || []));
    const valid = urls.map(u => String(u).trim()).filter(u => /^https?:\/\//i.test(u));
    if (!valid.length) return 'Nenhum link encontrado.';
    return valid.map(l => `<a href="${l}" target="_blank" rel="noopener noreferrer" style="color: var(--afs-orange-400);">${l}</a>`).join('<br>');
}

function renderModalReviewPhoto(ev) {
    const container = document.getElementById('modalPhotoContainer');
    if (!container) return;
    const photos = photosFromEvaluation(ev);
    if (!photos.length) {
        container.innerHTML = '<div class="modal-photo-empty"><i class="fa-solid fa-camera"></i><span>Foto Indisponível</span></div>';
        return;
    }
    const src = photos[0].url;
    container.innerHTML = `<img src="${src}" referrerpolicy="no-referrer" class="modal-review-photo" alt="Foto do Bem" onerror="this.parentElement.innerHTML='<div class=\\'modal-photo-empty\\'><i class=\\'fa-solid fa-image-slash\\'></i><span>Erro ao carregar</span></div>'"/>`;
}

function updateSideConservationAge(data) {
    const consEl = document.getElementById('sideConservation');
    const consNote = document.getElementById('sideConservationNote');
    const ageEl = document.getElementById('sideAge');
    const tagEl = document.getElementById('sideTag');
    if (!consEl) return;

    const cons = data.conservation_state ?? data.conservation;
    const age = data.apparent_age ?? data.age;
    const tag = data.tag_verificada ?? data.tag_verified ?? data.tag;

    consEl.textContent = formatConservationLabel(cons);
    ageEl.textContent = (age !== null && age !== undefined && age !== '') ? `${age} anos` : '-';
    tagEl.textContent = tag ? `Tag: ${tag}` : '';
    consNote.textContent = data.raciocinio_visual ? String(data.raciocinio_visual).slice(0, 120) : '';
}

function updateSideValuation(data) {
    const val = data.valuation || {};
    const ativo = data.ativo || val.ativo || '';
    const categoria = data.categoria || val.categoria || '';
    const ativoEl = document.getElementById('sideAsset');
    const catEl = document.getElementById('sideCategoria');
    if (catEl) catEl.textContent = categoria || '-';
    if (ativoEl) ativoEl.textContent = ativo || '-';

    if (val.descricao_identificacao) {
        const descIa = document.getElementById('sideDescIA');
        if (descIa) descIa.textContent = val.descricao_identificacao;
    }
    if (val.metodologia) {
        const meth = document.getElementById('sideMethodology');
        if (meth) meth.textContent = val.metodologia;
    }
    if (val.raciocinio_detalhado) {
        const reasoning = document.getElementById('sideReasoning');
        if (reasoning) reasoning.innerHTML = String(val.raciocinio_detalhado).replace(/\n/g, '<br>');
    }
    const fmtNum = (v) => v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
    if (val.valor_usado != null) {
        const el = document.getElementById('sideValueUsed');
        if (el) el.textContent = fmtNum(val.valor_usado);
    }
    if (val.valor_novo != null) {
        const el = document.getElementById('sideValueNew');
        if (el) el.textContent = fmtNum(val.valor_novo);
    }
    if (val.valor_fipe != null) {
        const el = document.getElementById('sideValueFipe');
        if (el) el.textContent = fmtNum(val.valor_fipe);
    }
    if (val.links_comparativos && val.links_comparativos.length) {
        const linksEl = document.getElementById('sideLinks');
        if (linksEl) linksEl.innerHTML = formatEvaluationLinksHtml({ links_array: val.links_comparativos });
    } else if (data.links || data.links_array) {
        const linksEl = document.getElementById('sideLinks');
        if (linksEl) linksEl.innerHTML = formatEvaluationLinksHtml(data);
    }
}

function formatEvalAssetCell(ativo, description) {
    if (ativo) {
        return `<strong style="color:var(--afs-orange-300);text-transform:lowercase;">${ativo}</strong>`;
    }
    const desc = description || '...';
    return desc.length > 40 ? `${desc.substring(0, 40)}…` : desc;
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
    await loadApiConfig();
    setupTabs();
    setupUpload();
    loadSessionState();
    loadSpreadsheetRegistry();
});

// ---------- Tab Navigation ----------
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('disabled')) return;
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Deactivate all
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate target
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    const content = document.getElementById(`tab${capitalize(tabId)}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');

    // Auto-load spreadsheet rows for evaluation when switching to evaluation tab
    if (tabId === 'research') {
        loadSpreadsheetRowsForEvaluation();
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function unlockTab(tabId) {
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    if (btn) {
        btn.classList.remove('disabled');
        const lock = btn.querySelector('.tab-lock');
        if (lock) lock.remove();
    }
}

function lockTab(tabId) {
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    if (!btn) return;
    btn.classList.add('disabled');
    if (!btn.querySelector('.tab-lock')) {
        const lock = document.createElement('span');
        lock.className = 'tab-lock';
        lock.textContent = '🔒';
        btn.appendChild(lock);
    }
}

function resetEvaluationControls() {
    browserEvaluationRunning = false;
    window.__afs_eval_paused = false;
    const btnPlay = document.getElementById('btnPlay');
    const btnPause = document.getElementById('btnPause');
    if (btnPlay) btnPlay.disabled = false;
    if (btnPause) btnPause.disabled = true;
    if (evaluationEventSource) {
        evaluationEventSource.close();
        evaluationEventSource = null;
    }
}

function resetInitFlowAfterSpreadsheetChange(hasExistingMappings) {
    state.initialized = false;
    resetEvaluationControls();
    lockTab('research');
    lockTab('learning');
    switchTab('init');
    const connector3 = document.getElementById('connector3');
    if (step4) {
        step4.classList.remove('completed');
        const num = step4.querySelector('.init-step-number');
        if (num) num.textContent = '4';
    }
    if (connector3) connector3.classList.remove('completed');

    if (hasExistingMappings) {
        updateStep(3, 'completed');
        updateStep(4, 'active');
    } else {
        updateStep(3, 'active');
        updateStep(4, 'active');
    }

    const finalizeSection = document.getElementById('cardFinalize');
    if (finalizeSection) finalizeSection.style.display = 'block';

    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (dot) dot.classList.remove('active');
    if (statusText) {
        statusText.textContent = hasRemoteApi() ? 'API remota conectada' : 'Modo navegador (sem servidor)';
    }
}

async function maybeAutoFinalizeIfReady() {
    if (!state.hasApiKey || !state.hasSpreadsheet) return false;
    try {
        const session = await apiFetch('/api/session-state');
        const mappings = session.column_mappings || {};
        if (!Object.keys(mappings).length) return false;
        const data = await apiFetch('/api/finalize-init', { method: 'POST' });
        if (data.status === 'ok') {
            state.initialized = true;
            updateStep(4, 'completed');
            unlockTab('research');
            unlockTab('learning');
            const dot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            if (dot) dot.classList.add('active');
            if (statusText) statusText.textContent = 'Sistema ativo';
            showAlert('Mapeamento encontrado — aba de avaliação liberada. Clique em Pesquisa & Avaliação e depois Play.', 'success');
            return true;
        }
    } catch (_) { /* manual finalize */ }
    return false;
}

async function clearSpreadsheetSessionUI() {
    state.hasSpreadsheet = false;
    state.hasMappings = false;
    state.initialized = false;
    state.spreadsheetHeaders = [];
    state.spreadsheetData = null;
    resetEvaluationControls();
    lockTab('research');
    lockTab('learning');
    switchTab('init');
    updateStep(3, 'active');
    updateStep(4, 'active');
    ['step2', 'step3', 'step4'].forEach((id, i) => {
        const step = document.getElementById(id);
        if (step) {
            step.classList.remove('completed');
            const num = step.querySelector('.init-step-number');
            if (num) num.textContent = String(i + 2);
        }
    });
    document.getElementById('connector1')?.classList.remove('completed');
    document.getElementById('connector2')?.classList.remove('completed');
    document.getElementById('connector3')?.classList.remove('completed');

    const zone = document.getElementById('uploadZone');
    const fileInfo = document.getElementById('fileInfo');
    zone?.classList.remove('has-file');
    fileInfo?.classList.remove('visible');

    document.getElementById('cardMapping')?.classList.remove('visible');
    document.getElementById('cardFinalize').style.display = 'none';

    const tbody = document.getElementById('evaluationTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhuma planilha carregada.</td></tr>';

    const dot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (dot) dot.classList.remove('active');
    if (statusText) {
        statusText.textContent = hasRemoteApi() ? 'API remota conectada' : 'Modo navegador (sem servidor)';
    }
}

// ---------- Session State ----------
function showSpreadsheetFileInfo(name, metaText) {
    const zone = document.getElementById('uploadZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    if (!fileName) return;
    fileName.textContent = name;
    if (fileMeta && metaText) fileMeta.textContent = metaText;
    fileInfo?.classList.add('visible');
    zone?.classList.add('has-file');
}

function applySavedMappings(mappings) {
    if (!mappings || typeof mappings !== 'object') return;
    Object.entries(mappings).forEach(([field, letter]) => {
        const sel = document.getElementById(`mapping_${field}`);
        if (sel && letter) sel.value = letter;
    });
}

async function restoreSpreadsheetMappingUI(sessionData) {
    const preview = sessionData?.spreadsheet_preview;
    if (!preview || !preview.headers) return;
    state.hasSpreadsheet = true;
    state.spreadsheetHeaders = preview.headers;
    state.spreadsheetData = preview;
    updateStep(2, 'completed');
    const fileLabel = preview.file_name || 'Planilha ativa';
    const meta = `${preview.total_rows || 0} linhas · ${preview.headers.length} colunas`;
    showSpreadsheetFileInfo(fileLabel, meta);
    await buildMappingUI(preview);
    applySavedMappings(sessionData.column_mappings);
    if (sessionData.has_mappings) {
        updateStep(3, sessionData.initialized ? 'completed' : 'active');
    }
    if (sessionData.initialized) {
        updateStep(4, 'completed');
        const finalizeSection = document.getElementById('cardFinalize');
        if (finalizeSection) finalizeSection.style.display = 'block';
    }
}

async function loadSessionState() {
    try {
        const data = hasRemoteApi()
            ? await (await fetch(apiUrl('/api/session-state'))).json()
            : await apiFetch('/api/session-state');
        
        if (data.has_api_key) {
            state.hasApiKey = true;
            document.getElementById('apiKeyInput').placeholder = '••••••••  (chave já configurada)';
            document.getElementById('btnTestKeys').disabled = false;
            updateStep(1, 'completed');
        }
        if (data.has_spreadsheet) {
            state.hasSpreadsheet = true;
            updateStep(2, 'completed');
            await restoreSpreadsheetMappingUI(data);
            const preview = data.spreadsheet_preview || {};
            if (preview.rows && !preview.photo_lookups?.bem && !(preview.photo_lookup && Object.keys(preview.photo_lookup).length)) {
                showAlert('Planilha em cache antigo — reenvie o arquivo .xlsx para indexar as fotos (3 abas).', 'warning');
            }
        }
        if (data.has_mappings) {
            state.hasMappings = true;
            updateStep(3, 'completed');
        }
        if (data.initialized) {
            state.initialized = true;
            updateStep(4, 'completed');
            unlockTab('research');
            unlockTab('learning');
            
            // Update header status
            document.getElementById('statusDot').classList.add('active');
            document.getElementById('statusText').textContent = 'Sistema ativo';
        }
    } catch (e) {
        console.warn('Não foi possível carregar estado da sessão:', e);
    }
}

// ---------- API Key ----------
async function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const btn = document.getElementById('btnSaveKey');
    const key = input.value.trim();

    if (!key) {
        showAlert('Insira a chave de API', 'warning');
        input.focus();
        return;
    }

    setLoading(btn, true);

    try {
        const data = await apiFetch('/api/set-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });

        if (data.status === 'ok') {
            state.hasApiKey = true;
            input.value = '';
            input.placeholder = '••••••••  (chave configurada)';
            input.type = 'password';
            document.getElementById('btnTestKeys').disabled = false;
            updateStep(1, 'completed');
            showAlert('Chave de API salva com sucesso', 'success');
        } else {
            showAlert(data.message || 'Erro ao salvar chave', 'error');
        }
    } catch (e) {
        showAlert('Erro de conexão: ' + e.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function testApiKeys() {
    const btn = document.getElementById('btnTestKeys');
    setLoading(btn, true);

    // Set all to pending
    ['Gemini', 'Search', 'Vision'].forEach(name => {
        updateApiStatus(name.toLowerCase(), 'pending', 'Testando...');
    });

    try {
        const data = await apiFetch('/api/test-keys', { method: 'POST' });

        for (const [api, result] of Object.entries(data)) {
            const statusClass = result.status === 'ok' ? 'ok' : 
                               result.status === 'pending' ? 'pending' : 'error';
            const icon = result.status === 'ok' ? '✓' : 
                        result.status === 'pending' ? '⏳' : '✗';
            updateApiStatus(api, statusClass, result.message || '', icon);
        }
    } catch (e) {
        ['gemini', 'search', 'vision'].forEach(api => {
            updateApiStatus(api, 'error', 'Erro de conexão');
        });
    } finally {
        setLoading(btn, false);
    }
}

function updateApiStatus(api, statusClass, message, icon) {
    const apiMap = { gemini: 'statusGemini', search: 'statusSearch', vision: 'statusVision' };
    const el = document.getElementById(apiMap[api]);
    if (!el) return;

    el.className = `api-status-item ${statusClass}`;
    const iconEl = el.querySelector('.status-icon');
    const resultEl = el.querySelector('.api-result');

    if (icon) iconEl.textContent = icon;
    else {
        const icons = { ok: '✓', error: '✗', pending: '⏳' };
        iconEl.textContent = icons[statusClass] || '○';
    }

    resultEl.textContent = message;
}

// ---------- File Upload ----------
function setupUpload() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            handleFileUpload(files[0]);
        }
    });

    // Click
    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            handleFileUpload(input.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    const zone = document.getElementById('uploadZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');

    if (!file.name.match(/\.xlsx?$/i)) {
        showAlert('Formato inválido. Envie um arquivo .xlsx ou .xls', 'error');
        return;
    }

    showSpreadsheetFileInfo(file.name, `${(file.size / 1024).toFixed(1)} KB`);

    // Upload
    try {
        showAlert('Enviando planilha...', 'info');

        let data;
        if (!hasRemoteApi()) {
            data = await browserHandleUpload(file);
        } else {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
            data = await res.json();
        }

        if (data.status === 'ok') {
            state.hasSpreadsheet = true;
            state.spreadsheetHeaders = data.headers;
            state.spreadsheetData = data;

            fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB · ${data.total_rows} linhas · ${data.headers.length} colunas${data.photo_count != null ? ` · ${data.photo_count} fotos` : ''}`;

            updateStep(2, 'completed');
            const photoMeta = data.photo_lookup_meta || {};
            const counts = photoMeta.counts || {};
            const sheets = photoMeta.sheets || {};
            const photoMsg = data.photo_count != null
                ? (data.photo_count > 0
                    ? ` · Fotos indexadas: ${counts.bem || 0} bem, ${counts.spec || 0} esp, ${counts.tag || 0} tag`
                    : ` · AVISO: 0 fotos (abas: ${sheets.bem || '?'}, ${sheets.spec || '?'}, ${sheets.tag || '?'}) — reenvie se faltar aba Foto do Bem/Espec/TAG`)
                : '';
            showAlert(`Planilha carregada: ${data.total_rows} linhas, ${data.headers.length} colunas${photoMsg}`, data.photo_count === 0 ? 'warning' : 'success');
            if (data.photo_count === 0) console.warn('[AFS Fotos] Nenhuma foto indexada. Abas encontradas:', sheets, counts);
            else console.info('[AFS Fotos] Indexação OK:', counts, 'Exemplo chave bem:', Object.keys(data.photo_lookups?.bem || {}).slice(0, 3));

            const sessionAfter = await apiFetch('/api/session-state');
            const hasMaps = Boolean(sessionAfter.column_mappings && Object.keys(sessionAfter.column_mappings).length);
            resetInitFlowAfterSpreadsheetChange(hasMaps);

            // Show mapping section
            buildMappingUI(data);
            applySavedMappings(sessionAfter.column_mappings);
            loadSpreadsheetRegistry();

            const autoReady = await maybeAutoFinalizeIfReady();
            if (!autoReady) {
                showAlert('Salve o mapeamento de colunas e clique em "Iniciar Sistema" para habilitar o Play.', 'info');
            }
        } else {
            showAlert(data.message || 'Erro ao processar planilha', 'error');
            zone.classList.remove('has-file');
            fileInfo.classList.remove('visible');
        }
    } catch (e) {
        showAlert('Erro ao enviar: ' + e.message, 'error');
        zone.classList.remove('has-file');
        fileInfo.classList.remove('visible');
    }
}

// ---------- Column Mapping ----------
async function buildMappingUI(spreadsheetData) {
    const mappingSection = document.getElementById('cardMapping');
    const finalizeSection = document.getElementById('cardFinalize');
    mappingSection.classList.add('visible');

    // Stats
    const statsEl = document.getElementById('previewStats');
    statsEl.innerHTML = `
        <div class="preview-stat">
            <span class="preview-stat-value">${spreadsheetData.total_rows}</span>
            <span class="preview-stat-label">linhas</span>
        </div>
        <div class="preview-stat">
            <span class="preview-stat-value">${spreadsheetData.headers.length}</span>
            <span class="preview-stat-label">colunas</span>
        </div>
        <div class="preview-stat">
            <span class="preview-stat-value">${spreadsheetData.sheet_names.length}</span>
            <span class="preview-stat-label">aba(s)</span>
        </div>
    `;

    // Fetch field definitions
    let fields;
    try {
        fields = hasRemoteApi()
            ? await (await fetch(apiUrl('/api/fields'))).json()
            : await apiFetch('/api/fields');
    } catch (e) {
        showAlert('Erro ao carregar campos: ' + e.message, 'error');
        return;
    }

    // Build column options with Auto-mapping support
    const headers = spreadsheetData.headers;
    
    // Regras de auto-mapeamento (Letras exatas da planilha padrão do usuário ou palavras-chave)
    const autoMapRules = {
        "tag_original": { letter: "E", keywords: ["tag", "tombamento", "plaqueta", "origem"] },
        "tag_output": { letter: "C", keywords: ["tag verificada", "tag nova", "ok", "revisão tag", "revisao tag"] },
        "desc_original": { letter: "BB", keywords: ["descrição", "identificação", "original"] },
        "desc_output": { letter: "BC", keywords: ["descrição ia", "reasoning", "descrição verificada"] },
        "age_original": { letter: "BL", keywords: ["idade origem", "idade original"] },
        "age_output": { letter: "H", keywords: ["idade verificada", "idade ia", "estimativa idade", "idade aparente"] },
        "conservation_original": { letter: "BN", keywords: ["conservação original", "estado original"] },
        "conservation_output": { letter: "J", keywords: ["conservação verificada", "estado ia", "conservação ia", "estado conservação"] },
        "methodology": { letter: "BD", keywords: ["metodologia"] },
        "value_new": { letter: "BH", keywords: ["novo"] },
        "value_used": { letter: "BI", keywords: ["usado", "comparativo"] },
        "value_fipe": { letter: "BJ", keywords: ["fipe"] },
        "link1": { letter: "BK", keywords: ["link 1", "link1", "link"] },
        "link2": { letter: "BN", keywords: ["link 2", "link2"] },
        "photo_original": { letter: "U", keywords: ["foto do bem", "foto do bem 1", "foto", "imagem"] },
        "photo_spec": { letter: "V", keywords: ["foto especificações", "foto especificação", "foto especificacoes", "foto especificacao"] },
        "photo_tag": { letter: "W", keywords: ["foto da tag", "foto tag", "foto da plaqueta"] },
        "control": { letter: "B", keywords: ["controle afs", "controle", "item", "seq", "nº"] },
        "category_output": { letter: "AZ", keywords: ["categoria", "grupo", "família", "familia"] },
        "asset_output": { letter: "BA", keywords: ["ativo", "tipo", "essência", "essencia"] }
    };

    function getBestMatch(fieldName) {
        const rule = autoMapRules[fieldName];
        if (!rule) return "";
        
        // 1. Prioriza a letra exata (se existir na planilha)
        if (headers.some(h => h.letter === rule.letter)) {
            return rule.letter;
        }
        
        // 2. Fallback para palavras-chave
        for (const kw of rule.keywords) {
            const match = headers.find(h => h.name && h.name.toLowerCase().includes(kw));
            if (match) return match.letter;
        }
        return "";
    }

    function generateOptionsHtml(bestMatchLetter) {
        return headers.map(h => {
            const selected = h.letter === bestMatchLetter ? 'selected' : '';
            return `<option value="${h.letter}" ${selected}>${h.letter} — ${h.name}</option>`;
        }).join('');
    }

    // Categorize fields into parts
    const partControlKeys = ["control"];

    function getFieldDef(fieldName) {
        const fromReq = fields.required?.[fieldName];
        const fromOpt = fields.optional?.[fieldName];
        const def = fromReq || fromOpt;
        if (!def) return null;
        if (typeof def === 'string') return { label: def, description: '' };
        return def;
    }

    function isRequiredField(fieldName) {
        return Boolean(fields.required?.[fieldName]);
    }

    // Parte 1 — linhas explícitas: origem (esq) → destino/IA (dir)
    const part1Rows = [
        ['tag_original', 'tag_output'],
        ['desc_original', 'desc_output'],
        ['age_original', 'age_output'],
        ['conservation_original', 'conservation_output'],
        ['photo_original', 'photo_spec'],
        ['photo_tag', null],
        ['category_output', 'asset_output', {}]
    ];

    const part2Rows = [
        ['methodology', 'value_new'],
        ['value_used', 'value_fipe'],
        ['link1', 'link2']
    ];

    function buildMappingFieldHtml(fieldName) {
        const fieldDef = getFieldDef(fieldName);
        if (!fieldDef) return '';
        const bestMatch = getBestMatch(fieldName);
        const optionsHtml = generateOptionsHtml(bestMatch);
        const type = isRequiredField(fieldName) ? 'required' : 'optional';
        return createMappingItem(fieldName, fieldDef, optionsHtml, type);
    }

    function renderMappingRows(container, rows, showColumnHeaders) {
        if (!container) return;
        container.innerHTML = '';
        if (showColumnHeaders) {
            container.innerHTML += `
                <div class="mapping-col-headers">
                    <div class="mapping-col-header">Origem — vistoria (esquerda)</div>
                    <div class="mapping-col-header dest">Destino / IA (direita)</div>
                </div>`;
        }
        rows.forEach(entry => {
            const opts = entry[2] || {};
            const leftKey = entry[0];
            const rightKey = entry[1];
            const leftHtml = buildMappingFieldHtml(leftKey);
            if (!leftHtml && !rightKey) return;
            const rightHtml = rightKey ? buildMappingFieldHtml(rightKey) : '<div class="mapping-item mapping-item-empty" aria-hidden="true"></div>';
            const rowClass = 'mapping-row';
            container.innerHTML += `<div class="${rowClass}">${leftHtml || '<div class="mapping-item mapping-item-empty"></div>'}${rightHtml}</div>`;
        });
    }

    // Control
    const gridControl = document.getElementById('mappingControl');
    if (gridControl) {
        gridControl.innerHTML = '';
        for (const fieldName of partControlKeys) {
            const html = buildMappingFieldHtml(fieldName);
            if (html) gridControl.innerHTML += html;
        }
    }

    renderMappingRows(document.getElementById('mappingPart1'), part1Rows, true);
    renderMappingRows(document.getElementById('mappingPart2'), part2Rows, true);

    // Preview table
    buildPreviewTable(spreadsheetData);

    // Show finalize section
    if (finalizeSection) finalizeSection.style.display = 'block';

    // Update step
    updateStep(3, 'active');
}

function createMappingItem(fieldName, fieldDef, optionsHtml, type) {
    return `
        <div class="mapping-item ${type}">
            <div class="mapping-item-label">
                ${fieldDef.label}
                <small>${fieldDef.description}</small>
            </div>
            <select id="mapping_${fieldName}" data-field="${fieldName}">
                <option value="">— Selecione —</option>
                ${optionsHtml}
            </select>
        </div>
    `;
}

function buildPreviewTable(data) {
    const thead = document.getElementById('previewTableHead');
    const tbody = document.getElementById('previewTableBody');

    // Headers (show first 15 columns max for readability)
    const displayHeaders = data.headers.slice(0, 15);
    thead.innerHTML = '<tr>' +
        displayHeaders.map(h =>
            `<th><span class="col-letter">${h.letter}</span>${h.name}</th>`
        ).join('') +
        (data.headers.length > 15 ? `<th style="color:var(--text-muted)">+${data.headers.length - 15} cols</th>` : '') +
        '</tr>';

    // Data rows
    const previewRows = data.preview_rows || data.preview || [];
    if (previewRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (displayHeaders.length + (data.headers.length > 15 ? 1 : 0)) + '" style="text-align:center;color:var(--text-muted);padding:16px;">Nenhuma linha de dados para exibir no preview.</td></tr>';
        return;
    }
    tbody.innerHTML = previewRows.map(row => {
        return '<tr>' +
            displayHeaders.map(h => {
                const val = row[h.letter];
                return `<td title="${val || ''}">${val !== null && val !== undefined ? val : ''}</td>`;
            }).join('') +
            (data.headers.length > 15 ? '<td>…</td>' : '') +
            '</tr>';
    }).join('');
}

async function saveMappings() {
    const btn = document.getElementById('btnSaveMappings');
    setLoading(btn, true);

    // Collect mappings
    const mappings = {};
    document.querySelectorAll('[data-field]').forEach(select => {
        const field = select.dataset.field;
        const value = select.value;
        if (value) mappings[field] = value;
    });

    if (Object.keys(mappings).length === 0) {
        showAlert('Selecione pelo menos uma coluna', 'warning');
        setLoading(btn, false);
        return;
    }

    try {
        const spreadsheetName = getActiveSpreadsheetName();
        const data = await apiFetch('/api/column-mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings, spreadsheet_name: spreadsheetName })
        });

        if (data.status === 'ok') {
            state.hasMappings = true;
            updateStep(3, 'completed');
            updateStep(4, 'active');
            const finalizeSection = document.getElementById('cardFinalize');
            if (finalizeSection) finalizeSection.style.display = 'block';
            showAlert(spreadsheetName
                ? `Mapeamento salvo para "${spreadsheetName}"!`
                : 'Mapeamento salvo com sucesso!', 'success');
            document.getElementById('cardMapping')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (data.status === 'incomplete') {
            state.hasMappings = true;
            updateStep(3, 'completed');
            updateStep(4, 'active');
            const finalizeSection = document.getElementById('cardFinalize');
            if (finalizeSection) finalizeSection.style.display = 'block';
            const missing = (data.missing || []).map(m => m.label).join(', ');
            showAlert(`Mapeamento salvo. Campos pendentes: ${missing}`, 'warning');
        } else {
            showAlert(data.message || 'Erro ao salvar mapeamento', 'error');
        }
    } catch (e) {
        showAlert('Erro: ' + e.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ---------- Finalize Init ----------
async function finalizeInit() {
    const btn = document.getElementById('btnFinalize');
    setLoading(btn, true);

    try {
        const data = await apiFetch('/api/finalize-init', { method: 'POST' });

        if (data.status === 'ok') {
            state.initialized = true;
            updateStep(4, 'completed');
            unlockTab('research');
            unlockTab('learning');

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Update header status
            document.getElementById('statusDot').classList.add('active');
            document.getElementById('statusText').textContent = 'Sistema ativo';

            showAlert('🚀 Sistema inicializado! Aba de Pesquisa & Avaliação desbloqueada.', 'success');
        } else {
            const issues = data.issues ? data.issues.join(', ') : data.message;
            showAlert(`Pendências: ${issues}`, 'warning');
        }
    } catch (e) {
        showAlert('Erro: ' + e.message, 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ---------- UI Helpers ----------
function updateStep(stepNum, status) {
    const step = document.getElementById(`step${stepNum}`);
    const connector = document.getElementById(`connector${stepNum - 1}`);

    if (!step) return;

    step.classList.remove('active', 'completed');
    step.classList.add(status);

    const numEl = step.querySelector('.init-step-number');
    if (status === 'completed') {
        if (numEl) numEl.textContent = '✓';
        if (connector) connector.classList.add('completed');
    } else if (numEl) {
        numEl.textContent = String(stepNum);
    }
}

function setLoading(btn, loading) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;

    // Remove previous alerts of same type
    container.querySelectorAll(`.alert-${type}`).forEach(a => a.remove());

    container.appendChild(alert);

    // Auto-dismiss after 5s (except errors)
    if (type !== 'error') {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-8px)';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }
}

// ---------- Evaluation Engine (Tab 2) ----------
let evaluationEventSource = null;
let browserEvaluationRunning = false;

function updateEvalProgressUI(data) {
    const wrap = document.getElementById('evalProgressWrap');
    if (!wrap) return;
    const label = document.getElementById('evalStepLabel');
    const bar = document.getElementById('evalProgressBar');
    const detail = document.getElementById('evalStepDetail');
    const pct = document.getElementById('evalProgressPct');

    if (data.status === 'finished') {
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100%';
        if (label) label.textContent = data.stepLabel || 'Avaliação finalizada';
        if (detail) detail.textContent = data.message || '';
        return;
    }

    if (data.stepLabel && label) label.textContent = data.stepLabel;
    if (data.overallPercent != null) {
        const p = Math.min(100, Math.max(0, data.overallPercent));
        if (bar) bar.style.width = `${p}%`;
        if (pct) pct.textContent = `${p}%`;
    }
    if (detail) {
        const ctrl = formatControlLabel(data.control, data.row);
        const parts = [];
        if (ctrl && ctrl !== '—') parts.push(`Controle: ${ctrl}`);
        if (data.itemPercent != null) parts.push(`etapa do item: ${data.itemPercent}%`);
        if (data.totalPending) parts.push(`${data.totalPending} pendente(s)`);
        detail.textContent = parts.join(' · ');
    }
}

function resetEvalProgressUI() {
    updateEvalProgressUI({ stepLabel: 'Aguardando início...', overallPercent: 0, itemPercent: 0 });
    const detail = document.getElementById('evalStepDetail');
    if (detail) detail.textContent = '';
}

function processEvaluationEvent(data, counters, pendingAtStart) {
    updateEvalProgressUI(data);

    if (data.status === 'finished') {
        document.getElementById('btnPlay').disabled = false;
        document.getElementById('btnPause').disabled = true;
        counters.processing = 0;
        document.getElementById('countPending').textContent = counters.pending;
        document.getElementById('countProcessing').textContent = counters.processing;
        document.getElementById('countDone').textContent = counters.done;
        document.getElementById('countIgnored').textContent = counters.ignored;
        showAlert('Avaliação finalizada!', 'success');
        loadSpreadsheetRegistry();
        return;
    }

    if (data.status && data.status.startsWith('Erro Orquestrador')) {
        showAlert(data.status, 'error');
        return;
    }

    if (data.status === 'error') {
        showAlert('Erro: ' + data.message, 'error');
        return;
    }

    if (data.tokens) {
        document.getElementById('tokenCounter').textContent = data.tokens.toLocaleString();
    }

    if (data.status === 'Avaliando') {
        counters.processing = 1;
        counters.pending = Math.max(0, pendingAtStart - counters.done - 1);
    } else if (data.status === 'Ignorado') {
        counters.processing = 0;
    } else if (data.status === 'Concluído' || (data.status && data.status.includes('Concluído'))) {
        counters.processing = 0;
        counters.done++;
        counters.pending = Math.max(0, pendingAtStart - counters.done);
    }

    document.getElementById('countPending').textContent = counters.pending;
    document.getElementById('countProcessing').textContent = counters.processing;
    document.getElementById('countDone').textContent = counters.done;

    const rowKey = evalRowId(data.row, data.control);
    let rowEl = document.getElementById(rowKey);
    if (!rowEl) {
        rowEl = document.getElementById(`eval_row_${data.row}`);
    }
    if (!rowEl) {
        rowEl = document.createElement('tr');
        rowEl.id = rowKey;
        rowEl.dataset.rowIndex = data.row;
        document.getElementById('evaluationTableBody').appendChild(rowEl);
    }

    let statusColor = 'var(--text-color)';
    if (data.status === 'Concluído') statusColor = 'var(--status-ok)';
    if (data.status && data.status.includes('Concluído')) statusColor = 'var(--status-ok)';
    if (data.status && data.status.includes('Erro')) statusColor = 'var(--status-error)';
    if (data.status === 'Avaliando') statusColor = 'var(--status-info)';

    if (data.control != null) rowEl.dataset.control = data.control;
    if (data.description) rowEl.dataset.description = data.description;
    if (data.ativo) rowEl.dataset.ativo = data.ativo;
    else if (data.valuation?.ativo) rowEl.dataset.ativo = data.valuation.ativo;
    if (data.categoria) rowEl.dataset.categoria = data.categoria;
    else if (data.valuation?.categoria) rowEl.dataset.categoria = data.valuation.categoria;
    if (data.eval_id) rowEl.dataset.eval_id = data.eval_id;
    if (data.photo_url) rowEl.dataset.photoUrl = normalizePhotoUrl(data.photo_url) || data.photo_url;
    if (data.photo_spec) rowEl.dataset.photoSpec = normalizePhotoUrl(data.photo_spec) || data.photo_spec;
    if (data.photo_tag) rowEl.dataset.photoTag = normalizePhotoUrl(data.photo_tag) || data.photo_tag;
    rowEl.dataset.status = data.status;

    const controlText = formatControlLabel(rowEl.dataset.control, data.row);
    const descText = rowEl.dataset.description || '...';
    const ativoText = rowEl.dataset.ativo || data.ativo || data.valuation?.ativo || '';
    const ctrlEsc = (rowEl.dataset.control || '').replace(/'/g, "\\'");

    const btnHtml = (data.status === 'Concluído' || (data.status && data.status.includes('Concluído'))) && rowEl.dataset.eval_id ?
        `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openReviewModal(${rowEl.dataset.eval_id}, ${data.row}, '${ctrlEsc}')">Revisar</button>` :
        `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" disabled>Revisar</button>`;

    rowEl.innerHTML = `
        <td>${controlText}</td>
        <td title="${ativoText || descText}">${formatEvalAssetCell(ativoText, descText)}</td>
        <td style="color: ${statusColor}; font-weight: bold;">${data.status}</td>
        <td>${(data.tokens || 0).toLocaleString()}</td>
        <td>${btnHtml}</td>
    `;

    rowEl.style.cursor = 'pointer';
    rowEl.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        document.querySelectorAll('#evaluationTable tr').forEach(r => r.classList.remove('selected-row'));
        rowEl.classList.add('selected-row');
        loadSidePanelDetails(
            rowEl.dataset.eval_id || null,
            data.row,
            rowEl.dataset.control,
            rowEl.dataset.photoUrl,
            rowEl.dataset.photoSpec,
            rowEl.dataset.photoTag,
            rowEl.dataset.description,
            data.photos || null
        );
    };

    if (data.status === 'Avaliando' || data.status === 'Concluído' || (data.status && data.status.startsWith('Erro'))) {
        document.querySelectorAll('#evaluationTable tr').forEach(r => r.classList.remove('selected-row'));
        rowEl.classList.add('selected-row');
        loadSidePanelDetails(
            data.eval_id || null,
            data.row,
            data.control || rowEl.dataset.control,
            normalizePhotoUrl(data.photo_url) || rowEl.dataset.photoUrl,
            normalizePhotoUrl(data.photo_spec) || rowEl.dataset.photoSpec,
            normalizePhotoUrl(data.photo_tag) || rowEl.dataset.photoTag,
            data.description || rowEl.dataset.description,
            data.photos || null
        );
        updateSideConservationAge(data);
        updateSideValuation(data);
    }

    const container = rowEl.closest('.data-table-container');
    if (container) container.scrollTop = container.scrollHeight;
}

async function loadSpreadsheetRowsForEvaluation() {
    const tbody = document.getElementById('evaluationTableBody');
    if (!tbody) return;
    
    // Se o EventSource estiver ativo ou avaliação rodando, não recarrega.
    if (evaluationEventSource !== null || browserEvaluationRunning) {
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando lista de ativos...</td></tr>';
    
    try {
        // Obter mapeamento de colunas do banco/sessão
        const sessionData = await apiFetch('/api/session-state');
        const mappings = sessionData.column_mappings || {};
        const spreadsheetMeta = sessionData.spreadsheet_preview || {};
        
        // Letras das colunas mapeadas
        const link1Letter = mappings.link1 || '';
        const controlLetter = mappings.control || '';
        const descLetter = mappings.desc_original || '';
        const assetLetter = mappings.asset_output || '';
        
        const data = await apiFetch('/api/spreadsheet-data');
        
        if (data.status !== 'ok') {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--status-error);">Erro ao carregar ativos: ${data.message || 'Erro desconhecido'}</td></tr>`;
            return;
        }

        // Carregar avaliações e linhas já processadas (memória persistente)
        const evalIndex = {};
        const evaluatedSet = new Set();
        try {
            const evalData = await apiFetch('/api/evaluations');
            (evalData.evaluations || []).forEach(ev => {
                if (ev.row_index != null && evalIndex[`r:${ev.row_index}`] == null) evalIndex[`r:${ev.row_index}`] = ev;
                if (ev.control != null && ev.control !== '' && evalIndex[`c:${ev.control}`] == null) evalIndex[`c:${ev.control}`] = ev;
            });
            const evRows = await apiFetch('/api/evaluated-rows');
            (evRows.rows || []).forEach(r => evaluatedSet.add(r));
        } catch (_) { /* sem avaliações */ }

        const photoMeta = {
            ...spreadsheetMeta,
            photo_lookups: data.photo_lookups || spreadsheetMeta.photo_lookups,
            photo_lookup: data.photo_lookup || spreadsheetMeta.photo_lookup,
            headers: spreadsheetMeta.headers
        };
        
        tbody.innerHTML = '';
        const rows = data.rows || [];
        
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum ativo encontrado na planilha principal.</td></tr>';
            return;
        }

        let pending = 0;
        let ignored = 0;
        let done = 0;
        
        rows.forEach(row => {
            const rowIdx = row._row_index;
            const controlVal = controlLetter ? row[controlLetter] : null;
            const descText = descLetter ? row[descLetter] : "Item sem descrição";
            const assetText = assetLetter ? row[assetLetter] : '';
            const rowPhotos = resolveRowPhotosForDisplay(row, mappings, photoMeta);
            const fotoUrl = rowPhotos.find(p => /bem/i.test(p.type || ''))?.url || rowPhotos[0]?.url || "Sem foto";
            const fotoTag = rowPhotos.find(p => /tag/i.test(p.type || ''))?.url || "Sem foto tag";
            const fotoSpec = rowPhotos.find(p => /espec/i.test(p.type || ''))?.url || "Sem foto especificação";
            const link1Val = link1Letter ? row[link1Letter] : null;

            const existingEval = evalIndex[`r:${rowIdx}`] || (controlVal != null ? evalIndex[`c:${controlVal}`] : null);
            const alreadyEvaluated = evaluatedSet.has(rowIdx) || Boolean(existingEval);
            
            let status = "Pendente";
            if (alreadyEvaluated) {
                status = "Ignorado";
                ignored++;
            } else if (link1Val !== null && link1Val !== undefined && String(link1Val).trim() !== "") {
                status = "Ignorado";
                ignored++;
            } else {
                pending++;
            }
            
            const rowEl = document.createElement('tr');
            rowEl.id = evalRowId(rowIdx, controlVal);
            rowEl.dataset.rowIndex = rowIdx;
            
            // Atribuir datasets para uso no side panel e no play loop
            if (controlVal) rowEl.dataset.control = controlVal;
            rowEl.dataset.description = descText;
            if (assetText) rowEl.dataset.ativo = String(assetText).trim();
            rowEl.dataset.photoUrl = fotoUrl;
            rowEl.dataset.photoSpec = fotoSpec;
            rowEl.dataset.photoTag = fotoTag;
            rowEl.dataset.status = status;
            if (existingEval) rowEl.dataset.eval_id = existingEval.id;
            
            const controlText = formatControlLabel(controlVal, rowIdx);
            
            let statusColor = 'var(--text-color)';
            if (status === 'Ignorado') statusColor = 'var(--text-muted)';
            if (status === 'Pendente') statusColor = 'var(--status-info)';

            const ctrlEsc = (controlVal != null ? String(controlVal) : '').replace(/'/g, "\\'");
            const btnHtml = existingEval
                ? `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openReviewModal(${existingEval.id}, ${rowIdx}, '${ctrlEsc}')">Revisar</button>`
                : `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" disabled>Revisar</button>`;
            
            rowEl.innerHTML = `
                <td>${controlText}</td>
                <td title="${assetText || descText}">${formatEvalAssetCell(assetText, descText)}</td>
                <td style="color: ${statusColor}; font-weight: bold;">${status}</td>
                <td>-</td>
                <td>${btnHtml}</td>
            `;
            
            rowEl.style.cursor = 'pointer';
            rowEl.onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                document.querySelectorAll('#evaluationTable tr').forEach(r => r.classList.remove('selected-row'));
                rowEl.classList.add('selected-row');
                loadSidePanelDetails(
                    existingEval ? existingEval.id : null, 
                    row, 
                    controlVal, 
                    fotoUrl, 
                    fotoSpec, 
                    fotoTag, 
                    descText,
                    rowPhotos
                );
            };
            
            tbody.appendChild(rowEl);
        });
        
        // Atualizar contadores na interface
        document.getElementById('countPending').textContent = pending;
        document.getElementById('countProcessing').textContent = 0;
        document.getElementById('countDone').textContent = done;
        document.getElementById('countIgnored').textContent = ignored;
        document.getElementById('tokenCounter').textContent = '0';
        
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--status-error);">Erro de conexão: ${e.message}</td></tr>`;
    }
}

async function startEvaluation() {
    const model = document.getElementById('aiModelSelect').value;
    const runTag = document.getElementById('cb_tag').checked;
    const runAge = document.getElementById('cb_age').checked;
    const runConservation = document.getElementById('cb_conservation').checked;
    const runMarket = document.getElementById('cb_market').checked;
    const runCategoria = document.getElementById('cb_categoria').checked;
    const runAtivo = document.getElementById('cb_ativo').checked;

    if (!runTag && !runAge && !runConservation && !runMarket && !runCategoria && !runAtivo) {
        showAlert('Selecione pelo menos uma tarefa para executar', 'warning');
        return;
    }

    window.__afs_eval_paused = false;
    resetEvalProgressUI();
    const progressWrap = document.getElementById('evalProgressWrap');
    if (progressWrap) progressWrap.style.display = 'block';

    document.getElementById('btnPlay').disabled = true;
    document.getElementById('btnPause').disabled = false;

    if (document.getElementById('evaluationTableBody').children.length === 0) {
        await loadSpreadsheetRowsForEvaluation();
    }

    const pendingAtStart = parseInt(document.getElementById('countPending').textContent) || 0;
    const ignoredAtStart = parseInt(document.getElementById('countIgnored').textContent) || 0;
    const counters = { pending: pendingAtStart, processing: 0, done: 0, ignored: ignoredAtStart };

    if (!hasRemoteApi()) {
        if (typeof browserRunEvaluation !== 'function') {
            showAlert('Motor de avaliação do navegador indisponível.', 'error');
            document.getElementById('btnPlay').disabled = false;
            document.getElementById('btnPause').disabled = true;
            return;
        }
        try {
            browserEvaluationRunning = true;
            const sessionData = await apiFetch('/api/session-state');
            await browserRunEvaluation({
                model,
                runTag,
                runAge,
                runConservation,
                runMarket,
                runCategoria,
                runAtivo,
                mappings: sessionData.column_mappings || {}
            }, (data) => processEvaluationEvent(data, counters, pendingAtStart));
        } catch (e) {
            showAlert('Erro na avaliação: ' + e.message, 'error');
        } finally {
            browserEvaluationRunning = false;
            document.getElementById('btnPlay').disabled = false;
            document.getElementById('btnPause').disabled = true;
        }
        return;
    }

    const query = new URLSearchParams({
        model: model,
        run_tag: runTag,
        run_age: runAge,
        run_conservation: runConservation,
        run_market: runMarket
    });

    evaluationEventSource = new EventSource(apiUrl(`/api/start-evaluation?${query.toString()}`));

    evaluationEventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.status === 'finished') {
            evaluationEventSource.close();
            evaluationEventSource = null;
        }
        processEvaluationEvent(data, counters, pendingAtStart);
    };

    evaluationEventSource.onerror = function(err) {
        console.error("SSE Error:", err);
        evaluationEventSource.close();
        evaluationEventSource = null;
        document.getElementById('btnPlay').disabled = false;
        document.getElementById('btnPause').disabled = true;
        showAlert('Conexão perdida ou finalizada com erro.', 'error');
    };
}

async function pauseEvaluation() {
    window.__afs_eval_paused = true;
    if (evaluationEventSource) {
        evaluationEventSource.close();
        evaluationEventSource = null;
    }
    browserEvaluationRunning = false;
    document.getElementById('btnPlay').disabled = false;
    document.getElementById('btnPause').disabled = true;

    try {
        await apiFetch('/api/pause-evaluation', { method: 'POST' });
        showAlert('Avaliação pausada pelo usuário.', 'info');
    } catch (e) {
        console.warn(e);
    }
}

// ---------- Review Modal ----------
let currentEvalId = null;

async function openReviewModal(evalId, row, control) {
    if (!evalId) return;
    currentEvalId = evalId;
    currentReviewRow = row;
    
    // Set basic info immediately
    document.getElementById('modalRow').textContent = row;
    document.getElementById('modalControl').textContent = control || '-';
    
    // Reset fields to loading
    document.getElementById('modalDescOriginal').textContent = 'Carregando...';
    document.getElementById('modalDescIA').textContent = 'Carregando...';
    document.getElementById('modalMethodology').textContent = 'Carregando...';
    document.getElementById('modalValueNew').textContent = '-';
    document.getElementById('modalValueUsed').textContent = '-';
    document.getElementById('modalValueFipe').textContent = '-';
    document.getElementById('modalLinks').innerHTML = 'Carregando...';
    document.getElementById('modalReasoning').textContent = 'Carregando...';
    const modalPhoto = document.getElementById('modalPhotoContainer');
    if (modalPhoto) {
        modalPhoto.innerHTML = '<div class="modal-photo-empty"><i class="fa-solid fa-camera"></i><span>Carregando...</span></div>';
    }
    
    // Hide correction block
    cancelCorrection();
    
    // Show modal (above gallery)
    document.getElementById('reviewModal').style.display = 'flex';
    
    try {
        const data = await apiFetch(`/api/evaluation/${evalId}`);
        
        if (data.status === 'ok') {
            const ev = data.evaluation;
            document.getElementById('modalDescOriginal').textContent = ev.asset_description;
            document.getElementById('modalDescIA').textContent = ev.asset_description; 
            
            document.getElementById('modalMethodology').textContent = ev.methodology || 'Não informada';
            
            const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
            document.getElementById('modalValueNew').textContent = fmtNum(ev.value_new);
            document.getElementById('modalValueUsed').textContent = fmtNum(ev.value_used);
            document.getElementById('modalValueFipe').textContent = fmtNum(ev.value_fipe);
            
            document.getElementById('modalReasoning').innerHTML = (ev.reasoning || '').replace(/\n/g, '<br>');
            
            if (ev.links) {
                document.getElementById('modalLinks').innerHTML = formatEvaluationLinksHtml(ev);
            } else {
                document.getElementById('modalLinks').textContent = 'Nenhum link encontrado.';
            }

            renderModalReviewPhoto(ev);
        } else {
            document.getElementById('modalReasoning').textContent = 'Erro ao carregar dados: ' + data.message;
        }
    } catch (e) {
        document.getElementById('modalReasoning').textContent = 'Erro de conexão: ' + e.message;
    }
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    cancelCorrection();
    currentEvalId = null;
    currentReviewRow = null;
}

function showCorrectionBlock() {
    document.getElementById('correctionFormBlock').style.display = 'flex';
    document.getElementById('btnShowCorrection').style.display = 'none';
    document.getElementById('feedbackCorrectedValue').focus();
}

function cancelCorrection() {
    document.getElementById('correctionFormBlock').style.display = 'none';
    const btnShow = document.getElementById('btnShowCorrection');
    if (btnShow) btnShow.style.display = 'inline-block';
    document.getElementById('feedbackCorrectedValue').value = '';
    document.getElementById('feedbackComment').value = '';
}

function reEvaluateWithFeedback() {
    const block = document.getElementById('correctionFormBlock');
    const hasValue = document.getElementById('feedbackCorrectedValue').value.trim();
    const hasComment = document.getElementById('feedbackComment').value.trim();
    const blockVisible = block && block.style.display === 'flex';

    if (!blockVisible) {
        showCorrectionBlock();
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showAlert('Informe o valor corrigido ou instrução para a IA e clique novamente em Re-avaliar.', 'info');
        return;
    }
    if (!hasValue && !hasComment) {
        showAlert('Informe um valor corrigido ou instrução para a IA.', 'warning');
        return;
    }
    submitReviewFeedback(false, true);
}

function parseBrazilianNumber(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return raw;
    let s = String(raw).trim().replace(/[R$\s]/gi, '');
    if (!s) return null;
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
}

async function submitReviewFeedback(accepted, reEvaluate = false) {
    if (!currentEvalId) return;
    
    let correctedValue = null;
    let comment = "";
    
    if (!accepted) {
        correctedValue = parseBrazilianNumber(document.getElementById('feedbackCorrectedValue').value.trim());
        comment = document.getElementById('feedbackComment').value.trim();
        if (correctedValue == null && !comment) {
            showAlert('Insira um valor de correção ou uma instrução/comentário.', 'warning');
            return;
        }
    }
    
    try {
        const model = document.getElementById('aiModelSelect')?.value || 'gemini-2.5-flash';
        const data = await apiFetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                evaluation_id: currentEvalId,
                accepted: accepted ? 1 : 0,
                corrected_value: correctedValue,
                user_comment: comment || null,
                row: currentReviewRow,
                re_evaluate: reEvaluate,
                model
            })
        });
        if (data.status === 'ok') {
            const updatedEv = data.evaluation || data.re_evaluate?.evaluation;
            if (updatedEv) {
                const rowEl = document.querySelector(`tr[data-eval_id="${currentEvalId}"]`);
                if (rowEl) {
                    rowEl.dataset.status = 'Concluído';
                    const fmtNum = (val) => val != null ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
                    const cells = rowEl.querySelectorAll('td');
                    if (cells.length >= 3) {
                        cells[2].textContent = 'Concluído (revisado)';
                        cells[2].style.color = 'var(--status-ok)';
                    }
                }
            }
            if (reEvaluate) {
                showAlert('Feedback registrado! Re-avaliação concluída com aprendizado aplicado.', 'success');
            } else {
                showAlert(accepted ? 'Avaliação aceita!' : 'Feedback e correção enviados!', 'success');
            }
            closeReviewModal();
            loadSpreadsheetRowsForEvaluation();
            loadSpreadsheetRegistry();
            if (document.getElementById('galleryModal')?.style.display === 'flex') {
                openGalleryModal();
            }
        } else {
            showAlert(data.message || 'Erro ao processar feedback.', 'error');
        }
    } catch (e) {
        showAlert('Erro ao enviar feedback: ' + e.message, 'error');
    }
}

// ---------- Filter Evaluation Table ----------
function filterEvaluationTable(filterType) {
    const tbody = document.getElementById('evaluationTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    const activeClass = 'active-filter-card';
    const clickedCard = document.getElementById(`card_filter_${filterType}`);
    const wasActive = clickedCard && clickedCard.classList.contains(activeClass);
    
    document.querySelectorAll('.filter-card').forEach(card => {
        card.classList.remove(activeClass);
        card.style.transform = 'none';
        card.style.boxShadow = 'none';
        card.style.borderColor = 'rgba(255,255,255,0.1)';
    });
    
    if (wasActive) {
        rows.forEach(r => r.style.display = '');
        return;
    }
    
    if (clickedCard) {
        clickedCard.classList.add(activeClass);
    }
    
    rows.forEach(row => {
        const status = row.dataset.status ? row.dataset.status.toLowerCase() : '';
        let show = false;
        
        if (filterType === 'pending' && status === 'pendente') {
            show = true;
        } else if (filterType === 'processing' && (status === 'avaliando' || status === 'processando')) {
            show = true;
        } else if (filterType === 'done' && (status === 'concluído' || status === 'concluido' || status.includes('concluído') || status.includes('concluido'))) {
            show = true;
        } else if (filterType === 'ignored' && status === 'ignorado') {
            show = true;
        }
        
        row.style.display = show ? '' : 'none';
    });
}

// ---------- Asset Gallery Modal ----------
let galleryPhotos = [];
let currentGalleryPhotoIndex = 0;

async function openGalleryModal() {
    document.getElementById('galleryModal').style.display = 'flex';
    const tbody = document.getElementById('galleryTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando banco de ativos...</td></tr>';
    
    // Reset gallery side panel details
    document.getElementById('galleryActiveItem').textContent = 'ID: -';
    document.getElementById('galleryDescOriginal').textContent = 'Selecione um ativo...';
    document.getElementById('galleryValueUsed').textContent = '-';
    document.getElementById('galleryValueNew').textContent = '-';
    document.getElementById('galleryValueFipe').textContent = '-';
    document.getElementById('galleryMethodology').textContent = '-';
    document.getElementById('galleryReasoning').textContent = '-';
    document.getElementById('galleryLinks').textContent = '-';
    galleryPhotos = [];
    updateGalleryPhotoUI();

    try {
        const data = await apiFetch('/api/evaluations');
        
        if (data.status === 'ok') {
            if (data.evaluations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum ativo avaliado no histórico.</td></tr>';
                return;
            }
            
            const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
            
            tbody.innerHTML = '';
            data.evaluations.forEach((ev, idx) => {
                const rowEl = document.createElement('tr');
                const ctrlEsc = (ev.control != null ? String(ev.control) : '').replace(/'/g, "\\'");
                const actionBtns = `
                    <button class="btn btn-secondary btn-sm" onclick="openReviewModal(${ev.id}, ${ev.row_index != null ? ev.row_index : 'null'}, '${ctrlEsc}')">Revisar</button>
                    <button class="btn btn-secondary btn-sm" onclick="openGalleryReEvaluate(${ev.id}, ${ev.row_index != null ? ev.row_index : 'null'}, '${ctrlEsc}')" style="margin-left:4px;background:var(--status-info);color:#fff;border:none;">Re-avaliar</button>`;
                rowEl.innerHTML = `
                    <td>${actionBtns}</td>
                    <td>#${ev.id}</td>
                    <td>${new Date(ev.created_at).toLocaleDateString('pt-BR')}</td>
                    <td title="${ev.asset_description}">${ev.asset_description.substring(0, 30)}...</td>
                    <td>${ev.methodology || '-'}</td>
                    <td>${fmtNum(ev.value_used)}</td>
                `;
                
                rowEl.style.cursor = 'pointer';
                rowEl.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    document.querySelectorAll('#galleryTable tr').forEach(r => r.classList.remove('selected-row'));
                    rowEl.classList.add('selected-row');
                    loadGallerySidePanelDetails(ev);
                };
                
                tbody.appendChild(rowEl);
                
                // Auto-select first item
                if (idx === 0) {
                    rowEl.classList.add('selected-row');
                    loadGallerySidePanelDetails(ev);
                }
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Erro: ${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Erro de conexão: ${e.message}</td></tr>`;
    }
}

function closeGalleryModal() {
    document.getElementById('galleryModal').style.display = 'none';
}

function openGalleryReEvaluate(evalId, row, control) {
    if (!evalId) return;
    openReviewModal(evalId, row, control);
    showCorrectionBlock();
    const block = document.getElementById('correctionFormBlock');
    if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadGallerySidePanelDetails(ev) {
    document.getElementById('galleryActiveItem').textContent = `ID: ${ev.id}${ev.control ? ` · Controle ${ev.control}` : ''}`;
    document.getElementById('galleryDescOriginal').textContent = ev.asset_description || 'Sem descrição';
    
    galleryPhotos = photosFromEvaluation(ev);
    currentGalleryPhotoIndex = 0;
    updateGalleryPhotoUI();
    
    const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
    document.getElementById('galleryValueUsed').textContent = fmtNum(ev.value_used);
    document.getElementById('galleryValueNew').textContent = fmtNum(ev.value_new);
    document.getElementById('galleryValueFipe').textContent = fmtNum(ev.value_fipe);
    
    document.getElementById('galleryMethodology').textContent = ev.methodology || 'Não informada';
    document.getElementById('galleryReasoning').innerHTML = (ev.reasoning || '').replace(/\n/g, '<br>');
    
    if (ev.links || ev.links_array) {
        document.getElementById('galleryLinks').innerHTML = formatEvaluationLinksHtml(ev);
    } else {
        document.getElementById('galleryLinks').textContent = '-';
    }
}

function prevGalleryPhoto() {
    if (galleryPhotos.length === 0) return;
    currentGalleryPhotoIndex = (currentGalleryPhotoIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
    updateGalleryPhotoUI();
}

function nextGalleryPhoto() {
    if (galleryPhotos.length === 0) return;
    currentGalleryPhotoIndex = (currentGalleryPhotoIndex + 1) % galleryPhotos.length;
    updateGalleryPhotoUI();
}

function updateGalleryPhotoUI() {
    const img = document.getElementById('galleryPhotoImg');
    const empty = document.getElementById('galleryPhotoEmpty');
    const typeLabel = document.getElementById('galleryPhotoType');
    const prevBtn = document.getElementById('btnPrevGalleryPhoto');
    const nextBtn = document.getElementById('btnNextGalleryPhoto');
    
    if (galleryPhotos.length === 0 || !galleryPhotos[currentGalleryPhotoIndex]) {
        img.style.display = 'none';
        empty.style.display = 'block';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        typeLabel.textContent = 'Sem Foto';
        return;
    }
    
    const photoObj = galleryPhotos[currentGalleryPhotoIndex];
    typeLabel.textContent = photoObj.type;
    img.src = photoObj.url;
    img.style.display = 'block';
    empty.style.display = 'none';
    prevBtn.disabled = galleryPhotos.length <= 1;
    nextBtn.disabled = galleryPhotos.length <= 1;
}

// ---------- Side Panel Carousel & Details ----------
let sidePhotos = [];
let currentSidePhotoIndex = 0;

function prevSidePhoto() {
    if (sidePhotos.length === 0) return;
    currentSidePhotoIndex = (currentSidePhotoIndex - 1 + sidePhotos.length) % sidePhotos.length;
    updateSidePhotoUI();
}

function nextSidePhoto() {
    if (sidePhotos.length === 0) return;
    currentSidePhotoIndex = (currentSidePhotoIndex + 1) % sidePhotos.length;
    updateSidePhotoUI();
}

function updateSidePhotoUI() {
    const img = document.getElementById('sidePhotoImg');
    const empty = document.getElementById('sidePhotoEmpty');
    const typeLabel = document.getElementById('sidePhotoType');
    const prevBtn = document.getElementById('btnPrevSidePhoto');
    const nextBtn = document.getElementById('btnNextSidePhoto');
    
    if (sidePhotos.length === 0 || !sidePhotos[currentSidePhotoIndex]) {
        img.style.display = 'none';
        empty.style.display = 'block';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        typeLabel.textContent = 'Sem Foto';
        const dbg = window.__lastPhotoDebug;
        if (dbg) {
            const cc = dbg.countColumns || {};
            const staleMsg = dbg.stale
                ? `<div style="background: rgba(249,115,22,0.18); border: 1px solid var(--afs-orange-400); border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; color: var(--afs-orange-400); font-weight: bold;">
                       ⚠ Planilha em cache antigo (sem índice de fotos). Vá em Inicialização → reenvie o .xlsx.
                   </div>`
                : '';
            empty.innerHTML = `
                <i class="fa-solid fa-camera" style="font-size: 2rem; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                <div style="font-size: 0.7rem; line-height: 1.45; text-align: left; padding: 0 8px;">
                    ${staleMsg}
                    <strong>Col A:</strong> ${dbg.colA ?? '-'} → <code>${dbg.assetCode ?? '?'}</code><br>
                    <strong>Qtd:</strong> bem=${cc.bem?.count ?? 0} (${cc.bem?.letter || '-'}) · esp=${cc.spec?.count ?? 0} · tag=${cc.tag?.count ?? 0}<br>
                    <strong>Índice:</strong> bem ${dbg.lookupSizes?.bem ?? 0} · esp ${dbg.lookupSizes?.spec ?? 0} · tag ${dbg.lookupSizes?.tag ?? 0}<br>
                    <strong>Chave .0:</strong> ${dbg.sampleKeys?.bem?.found ? 'OK' : 'não encontrada'} ${dbg.sampleKeys?.bem?.key || ''}<br>
                    ${dbg.bemKeySamples?.length ? `<strong>Ex. índice bem:</strong> ${dbg.bemKeySamples.join(', ')}<br>` : ''}
                    ${dbg.nearKeys?.length ? `<strong>Chaves próximas:</strong> ${dbg.nearKeys.join(', ')}<br>` : ''}
                    <span style="color: var(--afs-orange-400);">Reenvie a planilha se índice = 0</span>
                </div>`;
        } else {
            empty.innerHTML = `<i class="fa-solid fa-camera" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i><span>Sem foto para este item</span>`;
        }
        return;
    }
    
    const photoObj = sidePhotos[currentSidePhotoIndex];
    typeLabel.textContent = photoObj.type;
    const imgUrl = typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(photoObj.url) : photoObj.url;
    img.src = imgUrl;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
        img.style.display = 'none';
        empty.style.display = 'block';
        typeLabel.textContent = 'Foto indisponível (link)';
    };
    img.style.display = 'block';
    empty.style.display = 'none';
    prevBtn.disabled = sidePhotos.length <= 1;
    nextBtn.disabled = sidePhotos.length <= 1;
}

async function loadSidePanelDetails(evalId, row, control, photoUrl, photoSpec, photoTag, description, photosFromRow) {
    const rowKey = typeof row === 'object' && row != null ? row._row_index : row;
    currentSideRow = rowKey;
    
    document.getElementById('sideActiveItem').textContent = `Controle: ${formatControlLabel(control, null)}`;
    document.getElementById('sideDescOriginal').textContent = description || 'Sem descrição';
    const ativoEl = document.getElementById('sideAsset');
    const catEl = document.getElementById('sideCategoria');
    if (ativoEl) ativoEl.textContent = '-';
    if (catEl) catEl.textContent = '-';
    
    sidePhotos = [];
    if (Array.isArray(photosFromRow) && photosFromRow.length) {
        sidePhotos = photosFromRow.filter(p => isValidPhotoUrl(p.url));
    } else {
        const pUrl = normalizePhotoUrl(photoUrl);
        const pSpec = normalizePhotoUrl(photoSpec);
        const pTag = normalizePhotoUrl(photoTag);
        if (isValidPhotoUrl(pUrl)) sidePhotos.push({ url: pUrl, type: 'Foto do Bem' });
        if (isValidPhotoUrl(pSpec)) sidePhotos.push({ url: pSpec, type: 'Foto Especificações' });
        if (isValidPhotoUrl(pTag)) sidePhotos.push({ url: pTag, type: 'Foto da TAG' });
    }

    const rowObj = typeof row === 'object' && row != null ? row : null;
    if (rowObj && sidePhotos.length === 0 && typeof afsDebugPhotoResolution === 'function') {
        try {
            const session = await apiFetch('/api/session-state');
            const spreadsheet = session.spreadsheet_preview || state.spreadsheetData || {};
            const mappings = session.column_mappings || {};
            const lookups = (typeof afsGetPhotoLookups === 'function')
                ? afsGetPhotoLookups(spreadsheet)
                : (spreadsheet.photo_lookups || { bem: {}, spec: {}, tag: {} });
            const retry = resolveRowPhotosForDisplay(rowObj, mappings, spreadsheet);
            if (retry.length) sidePhotos = retry.filter(p => isValidPhotoUrl(p.url));
            const stale = !spreadsheet.photo_lookups
                || (!Object.keys(lookups.bem).length && !Object.keys(lookups.spec).length && !Object.keys(lookups.tag).length);
            window.__lastPhotoDebug = {
                ...afsDebugPhotoResolution(rowObj, mappings, lookups, spreadsheet.headers),
                stale
            };
            console.info('[AFS Foto Debug]', window.__lastPhotoDebug);
        } catch (e) {
            window.__lastPhotoDebug = null;
        }
    } else if (sidePhotos.length) {
        window.__lastPhotoDebug = null;
    }
    
    currentSidePhotoIndex = 0;
    updateSidePhotoUI();
    
    // Reset fields
    document.getElementById('sideDescIA').textContent = 'Carregando...';
    document.getElementById('sideMethodology').textContent = 'Carregando...';
    document.getElementById('sideValueUsed').textContent = '-';
    document.getElementById('sideValueNew').textContent = '-';
    document.getElementById('sideValueFipe').textContent = '-';
    document.getElementById('sideReasoning').textContent = 'Carregando...';
    document.getElementById('sideLinks').innerHTML = 'Carregando...';
    updateSideConservationAge({});
    
    if (!evalId) {
        // If not evaluated yet, show placeholder/processing state
        document.getElementById('sideDescIA').textContent = 'Aguardando avaliação...';
        document.getElementById('sideMethodology').textContent = '-';
        document.getElementById('sideReasoning').textContent = 'Aguardando avaliação...';
        document.getElementById('sideLinks').innerHTML = '-';
        return;
    }
    
    try {
        const data = await apiFetch(`/api/evaluation/${evalId}`);
        
        // Prevent race condition of rapid SSE events updates
        if (currentSideRow !== rowKey) return;
        
        if (data.status === 'ok') {
            const ev = data.evaluation;
            if (ativoEl) ativoEl.textContent = ev.asset_normalized || '-';
            if (catEl) catEl.textContent = ev.category_normalized || '-';
            document.getElementById('sideDescIA').textContent = ev.asset_description || description;
            document.getElementById('sideMethodology').textContent = ev.methodology || 'Não informada';
            
            const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
            document.getElementById('sideValueUsed').textContent = fmtNum(ev.value_used);
            document.getElementById('sideValueNew').textContent = fmtNum(ev.value_new);
            document.getElementById('sideValueFipe').textContent = fmtNum(ev.value_fipe);
            
            document.getElementById('sideReasoning').innerHTML = (ev.reasoning || '').replace(/\n/g, '<br>');
            updateSideConservationAge({
                conservation_state: ev.conservation_state,
                apparent_age: ev.apparent_age,
                tag_verified: ev.tag_verified,
                raciocinio_visual: ev.reasoning
            });

            // Atualizar galeria com fotos persistidas na avaliação
            sidePhotos = photosFromEvaluation(ev);
            if (!sidePhotos.length && Array.isArray(photosFromRow)) {
                sidePhotos = photosFromRow.filter(p => isValidPhotoUrl(p.url));
            }
            currentSidePhotoIndex = 0;
            updateSidePhotoUI();
            
            if (ev.links || ev.links_array) {
                document.getElementById('sideLinks').innerHTML = formatEvaluationLinksHtml(ev);
            } else {
                document.getElementById('sideLinks').textContent = '-';
            }
        } else {
            document.getElementById('sideReasoning').textContent = 'Erro ao carregar dados: ' + data.message;
        }
    } catch (e) {
        if (currentSideRow !== rowKey) return;
        document.getElementById('sideReasoning').textContent = 'Erro: ' + e.message;
    }
}

// ---------- Download & Spreadsheet Registry ----------
async function downloadResults() {
    if (useBrowserSpreadsheetExport()) {
        try {
            if (typeof browserExportSpreadsheet !== 'function') {
                throw new Error('Exportação não disponível. Recarregue com Ctrl+Shift+R (?v=23).');
            }
            if (typeof XLSX === 'undefined') {
                throw new Error('Biblioteca XLSX não carregada. Recarregue a página.');
            }
            browserExportSpreadsheet();
            showAlert('Download iniciado — planilha com resultados da IA.', 'success');
        } catch (e) {
            showAlert('Erro ao exportar: ' + e.message, 'error');
        }
        return;
    }
    try {
        const res = await fetch(apiUrl('/api/download-excel'));
        if (!res.ok) throw new Error('Servidor não retornou o arquivo');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'planilha-afs-resultado.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showAlert('Planilha exportada.', 'success');
    } catch (e) {
        showAlert('Erro ao exportar: ' + e.message, 'error');
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function renderRegistryList(containerId, files, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!files || files.length === 0) {
        el.innerHTML = '<div class="registry-item"><span class="registry-item-name" style="color:var(--text-muted)">Nenhuma planilha</span></div>';
        return;
    }
    el.innerHTML = files.map(f => {
        const activeClass = f.active ? ' active' : '';
        const date = new Date(f.modified * 1000).toLocaleString('pt-BR');
        const escapedName = f.name.replace(/'/g, "\\'");
        const activateBtn = type === 'input' && !f.active
            ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); activateSpreadsheet('${escapedName}')" title="Ativar">▶</button>`
            : '';
        const rowClick = type === 'input'
            ? ` onclick="activateSpreadsheet('${escapedName}')" style="cursor:pointer;" title="Selecionar planilha"`
            : '';
        const downloadBtn = type === 'output' && !useBrowserSpreadsheetExport()
            ? `<a class="btn btn-secondary btn-sm" href="${downloadFileUrl('/api/download-output/' + encodeURIComponent(f.name))}" title="Download">⬇</a>`
            : (type === 'output' && useBrowserSpreadsheetExport()
                ? `<button class="btn btn-secondary btn-sm" onclick="downloadResults()" title="Exportar planilha atual">⬇</button>`
                : '');
        return `<div class="registry-item${activeClass}"${rowClick}>
            <span class="registry-item-name" title="${f.name}">${f.name}${f.active ? ' (ativa)' : ''}<br><small style="color:var(--text-muted)">${formatFileSize(f.size)} · ${date}</small></span>
            <div class="registry-item-actions" onclick="event.stopPropagation()">
                ${activateBtn}
                ${downloadBtn}
                <button class="btn btn-secondary btn-sm" onclick="deleteSpreadsheet('${type}', '${escapedName}')" title="Excluir">🗑</button>
            </div>
        </div>`;
    }).join('');
}

async function loadSpreadsheetRegistry() {
    try {
        const [inputData, outputData] = await Promise.all([
            apiFetch('/api/spreadsheets/input'),
            apiFetch('/api/spreadsheets/output')
        ]);
        renderRegistryList('inputSpreadsheetsList', inputData.files || [], 'input');
        renderRegistryList('outputSpreadsheetsList', outputData.files || [], 'output');
    } catch (e) {
        const msg = `<div class="registry-item"><span class="registry-item-name" style="color:var(--status-error)">${e.message}</span></div>`;
        const inEl = document.getElementById('inputSpreadsheetsList');
        const outEl = document.getElementById('outputSpreadsheetsList');
        if (inEl) inEl.innerHTML = msg;
        if (outEl) outEl.innerHTML = msg;
    }
}

async function deleteSpreadsheet(type, filename) {
    if (!confirm(`Excluir planilha "${filename}"?`)) return;
    try {
        const path = type === 'input' ? '/api/spreadsheets/input' : '/api/spreadsheets/output';
        const data = await apiFetch(path, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (data.status !== 'ok') {
            showAlert(data.message || 'Erro ao excluir planilha.', 'error');
            return;
        }
        showAlert('Planilha removida.', 'success');
        const session = await apiFetch('/api/session-state');
        if (!session.has_spreadsheet) {
            await clearSpreadsheetSessionUI();
        } else {
            await restoreSpreadsheetMappingUI(session);
            const autoReady = await maybeAutoFinalizeIfReady();
            if (!autoReady && !session.initialized) {
                resetInitFlowAfterSpreadsheetChange(Boolean(session.has_mappings));
            }
        }
        loadSpreadsheetRegistry();
    } catch (e) {
        showAlert('Erro ao excluir: ' + e.message, 'error');
    }
}

async function activateSpreadsheet(filename) {
    try {
        const data = await apiFetch('/api/spreadsheets/input/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (data.status !== 'ok') {
            showAlert(data.message || 'Erro ao ativar planilha', 'error');
            return;
        }
        const preview = data.preview || data;
        const sessionData = await apiFetch('/api/session-state');
        sessionData.spreadsheet_preview = preview;
        if (data.column_mappings) sessionData.column_mappings = data.column_mappings;
        await restoreSpreadsheetMappingUI(sessionData);
        resetEvaluationControls();
        const autoReady = await maybeAutoFinalizeIfReady();
        if (!autoReady) {
            resetInitFlowAfterSpreadsheetChange(Boolean(data.column_mappings && Object.keys(data.column_mappings).length));
            applySavedMappings(data.column_mappings);
        }
        showAlert(`Planilha "${filename}" selecionada.`, 'success');
        loadSpreadsheetRegistry();
        document.getElementById('cardMapping')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        showAlert('Erro ao ativar: ' + e.message, 'error');
    }
}

// ---------- Aba Revisão & Aprendizado ----------
async function loadLearningTab() {
    try {
        const data = await apiFetch('/api/learning-rules');
        const editor = document.getElementById('learningRulesEditor');
        if (editor) {
            editor.value = data.rules || (typeof AFS_DEFAULT_LEARNING_RULES !== 'undefined' ? AFS_DEFAULT_LEARNING_RULES : '');
        }
    } catch (e) {
        console.warn('Erro ao carregar regras:', e);
    }
}

async function saveLearningRules() {
    const editor = document.getElementById('learningRulesEditor');
    if (!editor) return;
    try {
        const data = await apiFetch('/api/learning-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: editor.value })
        });
        if (data.status === 'ok') showAlert('Regras de aprendizado salvas!', 'success');
        else showAlert(data.message || 'Erro ao salvar', 'error');
    } catch (e) {
        showAlert('Erro: ' + e.message, 'error');
    }
}

async function loadAllLearnings() {
    const dump = document.getElementById('learningsDump');
    if (!dump) return;
    dump.textContent = 'Carregando...';
    try {
        const data = await apiFetch('/api/learnings');
        dump.textContent = data.formatted || 'Nenhum aprendizado registrado.';
    } catch (e) {
        dump.textContent = 'Erro: ' + e.message;
    }
}

