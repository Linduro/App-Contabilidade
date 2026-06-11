// ============================================================
// Asset Solutions Valuation — Frontend Logic
// static/js/app.js
// ============================================================

function getAfsApiBase() {
    if (typeof window !== 'undefined' && window.__AFS_API_BASE__ != null) {
        return String(window.__AFS_API_BASE__).replace(/\/$/, '');
    }
    return '';
}

function apiUrl(path) {
    const base = getAfsApiBase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
}

async function loadApiConfig() {
    try {
        const configPath = window.location.pathname.replace(/\/[^/]*$/, '/config.json');
        const res = await fetch(`${configPath}?t=${Date.now()}`);
        if (!res.ok) return;
        const cfg = await res.json();
        if (cfg.apiBase && String(cfg.apiBase).trim()) {
            window.__AFS_API_BASE__ = String(cfg.apiBase).replace(/\/$/, '');
        }
    } catch (e) {
        console.warn('Config API não carregada:', e);
    }
}

async function apiFetch(path, options = {}) {
    const res = await fetch(apiUrl(path), options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const preview = (await res.text()).slice(0, 80);
        if (preview.trimStart().startsWith('<')) {
            throw new Error(
                'Servidor da API indisponível. O deploy automático está em andamento — aguarde alguns minutos e recarregue a página.'
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

function isValidPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim().toLowerCase();
    if (!u || u.includes('sem foto') || u.includes('sem imagem') ||
        u.includes('indisponivel') || u.includes('indisponível')) return false;
    return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//');
}

function formatConservationLabel(value) {
    if (value === null || value === undefined || value === '') return '-';
    const labels = {
        5: '5 — Novo na caixa',
        4: '4 — Novo fora da caixa',
        3: '3 — Bom estado relativo',
        2: '2 — Mau estado',
        1: '1 — Péssimo / sucata'
    };
    const num = parseInt(value, 10);
    return labels[num] || String(value);
}

function updateSideConservationAge(data) {
    const consEl = document.getElementById('sideConservation');
    const consNote = document.getElementById('sideConservationNote');
    const ageEl = document.getElementById('sideAge');
    const tagEl = document.getElementById('sideTag');
    if (!consEl) return;

    const cons = data.conservation_state ?? data.conservation;
    const age = data.apparent_age ?? data.age;
    const tag = data.tag_verificada ?? data.tag;

    consEl.textContent = formatConservationLabel(cons);
    ageEl.textContent = (age !== null && age !== undefined && age !== '') ? `${age} anos` : '-';
    tagEl.textContent = tag ? `Tag: ${tag}` : '';
    consNote.textContent = data.raciocinio_visual ? String(data.raciocinio_visual).slice(0, 120) : '';
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

// ---------- Session State ----------
async function loadSessionState() {
    try {
        const res = await fetch(apiUrl('/api/session-state'));
        const data = await res.json();
        
        if (data.has_api_key) {
            state.hasApiKey = true;
            document.getElementById('apiKeyInput').placeholder = '••••••••  (chave já configurada)';
            document.getElementById('btnTestKeys').disabled = false;
            updateStep(1, 'completed');
        }
        if (data.has_spreadsheet) {
            state.hasSpreadsheet = true;
            updateStep(2, 'completed');
        }
        if (data.has_mappings) {
            state.hasMappings = true;
            updateStep(3, 'completed');
        }
        if (data.initialized) {
            state.initialized = true;
            updateStep(4, 'completed');
            unlockTab('research');
            
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

    // Show file info
    fileName.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    fileInfo.classList.add('visible');
    zone.classList.add('has-file');

    // Upload
    const formData = new FormData();
    formData.append('file', file);

    try {
        showAlert('Enviando planilha...', 'info');

        const res = await fetch(apiUrl('/api/upload'), {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.status === 'ok') {
            state.hasSpreadsheet = true;
            state.spreadsheetHeaders = data.headers;
            state.spreadsheetData = data;

            fileMeta.textContent = `${(file.size / 1024).toFixed(1)} KB · ${data.total_rows} linhas · ${data.headers.length} colunas`;

            updateStep(2, 'completed');
            showAlert(`Planilha carregada: ${data.total_rows} linhas, ${data.headers.length} colunas`, 'success');

            // Show mapping section
            buildMappingUI(data);
            loadSpreadsheetRegistry();
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
        const res = await fetch(apiUrl('/api/fields'));
        fields = await res.json();
    } catch (e) {
        showAlert('Erro ao carregar campos: ' + e.message, 'error');
        return;
    }

    // Build column options with Auto-mapping support
    const headers = spreadsheetData.headers;
    
    // Regras de auto-mapeamento (Letras exatas da planilha padrão do usuário ou palavras-chave)
    const autoMapRules = {
        "tag_original": { letter: "E", keywords: ["tag", "tombamento", "plaqueta", "origem"] },
        "tag_output": { letter: "D", keywords: ["tag verificada", "tag nova", "ok"] },
        "desc_original": { letter: "BB", keywords: ["descrição", "identificação", "original"] },
        "desc_output": { letter: "BC", keywords: ["descrição ia", "reasoning", "descrição verificada"] },
        "age_original": { letter: "BL", keywords: ["idade origem", "idade original"] },
        "age_output": { letter: "BK", keywords: ["idade verificada", "idade ia"] },
        "conservation_original": { letter: "BN", keywords: ["conservação original", "estado original"] },
        "conservation_output": { letter: "BM", keywords: ["conservação verificada", "estado ia"] },
        "methodology": { letter: "BD", keywords: ["metodologia"] },
        "value_new": { letter: "BH", keywords: ["novo"] },
        "value_used": { letter: "BI", keywords: ["usado", "comparativo"] },
        "value_fipe": { letter: "BJ", keywords: ["fipe"] },
        "link1": { letter: "BK", keywords: ["link 1", "link1", "link"] },
        "link2": { letter: "BN", keywords: ["link 2", "link2"] },
        "photo_original": { letter: "U", keywords: ["foto do bem", "foto do bem 1", "foto", "imagem"] },
        "photo_spec": { letter: "V", keywords: ["foto especificações", "foto especificação", "foto especificacoes", "foto especificacao"] },
        "photo_tag": { letter: "W", keywords: ["foto da tag", "foto tag", "foto da plaqueta"] }
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
    const part1Keys = ["tag_original", "tag_output", "desc_original", "desc_output", "age_original", "age_output", "conservation_original", "conservation_output", "photo_original", "photo_spec", "photo_tag"];
    const part2Keys = ["methodology", "value_new", "value_used", "value_fipe", "link1", "link2"];


    function getFieldDef(fieldName) {
        return fields.required[fieldName] || fields.optional[fieldName];
    }

    // Control
    const gridControl = document.getElementById('mappingControl');
    if (gridControl) {
        gridControl.innerHTML = '';
        for (const fieldName of partControlKeys) {
            const fieldDef = getFieldDef(fieldName);
            if (!fieldDef) continue;
            // auto select column A for control as guess, or keyword "controle"
            const rule = { letter: "A", keywords: ["controle afs", "controle", "item", "seq"] };
            let bestMatch = "";
            if (headers.some(h => h.letter === rule.letter)) bestMatch = rule.letter;
            else {
                const match = headers.find(h => h.name && rule.keywords.some(k => h.name.toLowerCase().includes(k)));
                if (match) bestMatch = match.letter;
            }
            const optionsHtml = generateOptionsHtml(bestMatch);
            gridControl.innerHTML += createMappingItem(fieldName, fieldDef, optionsHtml, 'required');
        }
    }

    // Parte 1
    const grid1 = document.getElementById('mappingPart1');
    grid1.innerHTML = '';
    for (const fieldName of part1Keys) {
        const fieldDef = getFieldDef(fieldName);
        if (!fieldDef) continue;
        const bestMatch = getBestMatch(fieldName);
        const optionsHtml = generateOptionsHtml(bestMatch);
        grid1.innerHTML += createMappingItem(fieldName, fieldDef, optionsHtml, 'required');
    }

    // Parte 2
    const grid2 = document.getElementById('mappingPart2');
    grid2.innerHTML = '';
    for (const fieldName of part2Keys) {
        const fieldDef = getFieldDef(fieldName);
        if (!fieldDef) continue;
        const bestMatch = getBestMatch(fieldName);
        const optionsHtml = generateOptionsHtml(bestMatch);
        grid2.innerHTML += createMappingItem(fieldName, fieldDef, optionsHtml, 'required');
    }

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
    const previewRows = data.preview_rows || [];
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
        const res = await fetch(apiUrl('/api/column-mappings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings })
        });

        const data = await res.json();

        if (data.status === 'ok') {
            state.hasMappings = true;
            updateStep(3, 'completed');
            updateStep(4, 'active');
            showAlert('Mapeamento salvo com sucesso!', 'success');
        } else if (data.status === 'incomplete') {
            state.hasMappings = true; // Allow continuing even with partial mapping
            updateStep(3, 'completed');
            updateStep(4, 'active');
            const missing = data.missing.map(m => m.label).join(', ');
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
        const res = await fetch(apiUrl('/api/finalize-init'), { method: 'POST' });
        const data = await res.json();

        if (data.status === 'ok') {
            state.initialized = true;
            updateStep(4, 'completed');
            unlockTab('research');

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

    if (status === 'completed') {
        step.querySelector('.init-step-number').textContent = '✓';
        if (connector) connector.classList.add('completed');
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

async function loadSpreadsheetRowsForEvaluation() {
    const tbody = document.getElementById('evaluationTableBody');
    if (!tbody) return;
    
    // Se o EventSource estiver ativo ou se o botão de play estiver desabilitado (está rodando), não recarrega.
    if (evaluationEventSource !== null || document.getElementById('btnPlay').disabled) {
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando lista de ativos...</td></tr>';
    
    try {
        // Obter mapeamento de colunas do banco/sessão
        const sessionRes = await fetch(apiUrl('/api/session-state'));
        const sessionData = await sessionRes.json();
        const mappings = sessionData.column_mappings || {};
        
        // Letras das colunas mapeadas
        const link1Letter = mappings.link1 || '';
        const controlLetter = mappings.control || '';
        const descLetter = mappings.desc_original || '';
        const photoUrlLetter = mappings.photo_original || '';
        const photoSpecLetter = mappings.photo_spec || '';
        const photoTagLetter = mappings.photo_tag || '';
        
        const res = await fetch(apiUrl('/api/spreadsheet-data'));
        const data = await res.json();
        
        if (data.status !== 'ok') {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--status-error);">Erro ao carregar ativos: ${data.message || 'Erro desconhecido'}</td></tr>`;
            return;
        }
        
        tbody.innerHTML = '';
        const rows = data.rows || [];
        
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum ativo encontrado na planilha principal.</td></tr>';
            return;
        }

        let pending = 0;
        let ignored = 0;
        
        rows.forEach(row => {
            const rowIdx = row._row_index;
            const controlVal = controlLetter ? row[controlLetter] : null;
            const descText = descLetter ? row[descLetter] : "Item sem descrição";
            const fotoUrl = photoUrlLetter ? row[photoUrlLetter] : "Sem foto";
            const fotoSpec = photoSpecLetter ? row[photoSpecLetter] : "Sem foto especificação";
            const fotoTag = photoTagLetter ? row[photoTagLetter] : "Sem foto tag";
            const link1Val = link1Letter ? row[link1Letter] : null;
            
            // Determinar status
            let status = "Pendente";
            if (link1Val !== null && link1Val !== undefined && String(link1Val).trim() !== "") {
                status = "Ignorado";
                ignored++;
            } else {
                pending++;
            }
            
            const rowEl = document.createElement('tr');
            rowEl.id = `eval_row_${rowIdx}`;
            
            // Atribuir datasets para uso no side panel e no play loop
            if (controlVal) rowEl.dataset.control = controlVal;
            rowEl.dataset.description = descText;
            rowEl.dataset.photoUrl = fotoUrl;
            rowEl.dataset.photoSpec = fotoSpec;
            rowEl.dataset.photoTag = fotoTag;
            rowEl.dataset.status = status;
            
            const controlText = controlVal ? `Item ${controlVal}` : `Linha ${rowIdx}`;
            
            let statusColor = 'var(--text-color)';
            if (status === 'Ignorado') statusColor = 'var(--text-muted)';
            if (status === 'Pendente') statusColor = 'var(--status-info)';
            
            rowEl.innerHTML = `
                <td>${controlText}</td>
                <td title="${descText}">${descText.substring(0, 30)}...</td>
                <td style="color: ${statusColor}; font-weight: bold;">${status}</td>
                <td>-</td>
                <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" disabled>Revisar</button></td>
            `;
            
            rowEl.style.cursor = 'pointer';
            rowEl.onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                document.querySelectorAll('#evaluationTable tr').forEach(r => r.classList.remove('selected-row'));
                rowEl.classList.add('selected-row');
                loadSidePanelDetails(
                    null, 
                    rowIdx, 
                    controlVal, 
                    fotoUrl, 
                    fotoSpec, 
                    fotoTag, 
                    descText
                );
            };
            
            tbody.appendChild(rowEl);
        });
        
        // Atualizar contadores na interface
        document.getElementById('countPending').textContent = pending;
        document.getElementById('countProcessing').textContent = 0;
        document.getElementById('countDone').textContent = 0;
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

    if (!runTag && !runAge && !runConservation && !runMarket) {
        showAlert('Selecione pelo menos uma tarefa para executar', 'warning');
        return;
    }

    document.getElementById('btnPlay').disabled = true;
    document.getElementById('btnPause').disabled = false;

    // Garantir que a tabela está carregada
    if (document.getElementById('evaluationTableBody').children.length === 0) {
        await loadSpreadsheetRowsForEvaluation();
    }
    
    const pendingAtStart = parseInt(document.getElementById('countPending').textContent) || 0;
    const ignoredAtStart = parseInt(document.getElementById('countIgnored').textContent) || 0;

    const counters = {
        pending: pendingAtStart,
        processing: 0,
        done: 0,
        ignored: ignoredAtStart
    };
    
    function updateCountersUI() {
        document.getElementById('countPending').textContent = counters.pending;
        document.getElementById('countProcessing').textContent = counters.processing;
        document.getElementById('countDone').textContent = counters.done;
        document.getElementById('countIgnored').textContent = counters.ignored;
    }
    
    updateCountersUI();

    // Initialize SSE
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
            document.getElementById('btnPlay').disabled = false;
            document.getElementById('btnPause').disabled = true;
            counters.processing = 0;
            updateCountersUI();
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

        // Update token counter
        if (data.tokens) {
            document.getElementById('tokenCounter').textContent = data.tokens.toLocaleString();
        }

        // Handle counters
        if (data.status === 'Avaliando') {
            counters.processing = 1;
            counters.pending = Math.max(0, pendingAtStart - counters.done - 1);
            updateCountersUI();
        } else if (data.status === 'Ignorado') {
            counters.processing = 0;
            // Se já estava ignorado na carga inicial, não faz nada com contador ignored
        } else if (data.status === 'Concluído' || data.status.includes('Concluído')) {
            counters.processing = 0;
            counters.done++;
            counters.pending = Math.max(0, pendingAtStart - counters.done);
            updateCountersUI();
        }

        // Update table row
        let rowEl = document.getElementById(`eval_row_${data.row}`);
        if (!rowEl) {
            rowEl = document.createElement('tr');
            rowEl.id = `eval_row_${data.row}`;
            document.getElementById('evaluationTableBody').appendChild(rowEl);
        }

        let statusColor = 'var(--text-color)';
        if (data.status === 'Concluído') statusColor = 'var(--status-ok)';
        if (data.status.includes('Erro')) statusColor = 'var(--status-error)';
        if (data.status === 'Avaliando') statusColor = 'var(--status-info)';

        // Preserve data across events
        if (data.control) rowEl.dataset.control = data.control;
        if (data.description) rowEl.dataset.description = data.description;
        if (data.eval_id) rowEl.dataset.eval_id = data.eval_id;
        if (data.photo_url) rowEl.dataset.photoUrl = data.photo_url;
        if (data.photo_spec) rowEl.dataset.photoSpec = data.photo_spec;
        if (data.photo_tag) rowEl.dataset.photoTag = data.photo_tag;
        rowEl.dataset.status = data.status;

        const controlText = rowEl.dataset.control ? `Item ${rowEl.dataset.control}` : `Linha ${data.row}`;
        const descText = rowEl.dataset.description || '...';
        
        const btnHtml = data.status === 'Concluído' && rowEl.dataset.eval_id ? 
            `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openReviewModal(${rowEl.dataset.eval_id}, ${data.row}, '${rowEl.dataset.control || ''}')">Revisar</button>` :
            `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" disabled>Revisar</button>`;

        rowEl.innerHTML = `
            <td>${controlText}</td>
            <td title="${descText}">${descText.substring(0, 30)}...</td>
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
                rowEl.dataset.description
            );
        };

        // Auto-select and show in side panel
        if (data.status === 'Avaliando' || data.status === 'Concluído' || data.status.startsWith('Erro')) {
            document.querySelectorAll('#evaluationTable tr').forEach(r => r.classList.remove('selected-row'));
            rowEl.classList.add('selected-row');
            loadSidePanelDetails(
                data.eval_id || null, 
                data.row, 
                data.control || rowEl.dataset.control, 
                data.photo_url || rowEl.dataset.photoUrl, 
                data.photo_spec || rowEl.dataset.photoSpec, 
                data.photo_tag || rowEl.dataset.photoTag, 
                data.description || rowEl.dataset.description
            );
            updateSideConservationAge(data);
        }

        // Scroll to bottom
        const container = rowEl.closest('.data-table-container');
        container.scrollTop = container.scrollHeight;
    };

    evaluationEventSource.onerror = function(err) {
        console.error("SSE Error:", err);
        evaluationEventSource.close();
        document.getElementById('btnPlay').disabled = false;
        document.getElementById('btnPause').disabled = true;
        showAlert('Conexão perdida ou finalizada com erro.', 'error');
    };
}

async function pauseEvaluation() {
    if (evaluationEventSource) {
        evaluationEventSource.close();
    }
    document.getElementById('btnPlay').disabled = false;
    document.getElementById('btnPause').disabled = true;
    
    try {
        await fetch(apiUrl('/api/pause-evaluation'), { method: 'POST' });
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
    
    // Hide correction block
    cancelCorrection();
    
    // Show modal
    document.getElementById('reviewModal').style.display = 'flex';
    
    try {
        const res = await fetch(apiUrl(`/api/evaluation/${evalId}`));
        const data = await res.json();
        
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
                const linksHtml = ev.links.split(',').map(l => `<a href="${l.trim()}" target="_blank" style="color: var(--afs-orange-400);">${l.trim()}</a>`).join('<br>');
                document.getElementById('modalLinks').innerHTML = linksHtml;
            } else {
                document.getElementById('modalLinks').textContent = 'Nenhum link encontrado.';
            }
            
            // Renderizar foto, se houver
            const photoLabel = document.getElementById('modalPhotoLabel');
            const photoContainer = photoLabel.parentElement.parentElement;
            if (ev.photo_url && ev.photo_url !== 'Sem foto') {
                photoContainer.innerHTML = `<img src="${ev.photo_url}" style="max-width:100%; max-height:200px; border-radius:8px;" alt="Foto do Bem" onerror="this.outerHTML='<div style=\\\'text-align:center; color:var(--status-error);\\\'><i class=\\\'fa-solid fa-image-slash fa-2x\\\'></i><br>Erro ao carregar imagem</div>'"/>`;
            } else {
                photoContainer.innerHTML = `<div style="text-align: center;"><i class="fa-solid fa-camera" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i><span>Foto Indisponível</span></div>`;
            }
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
    document.getElementById('btnShowCorrection').style.display = 'inline-block';
    document.getElementById('feedbackCorrectedValue').value = '';
    document.getElementById('feedbackComment').value = '';
}

async function submitReviewFeedback(accepted, reEvaluate = false) {
    if (!currentEvalId) return;
    
    let correctedValue = null;
    let comment = "";
    
    if (!accepted) {
        correctedValue = document.getElementById('feedbackCorrectedValue').value.trim();
        comment = document.getElementById('feedbackComment').value.trim();
        if (!correctedValue && !comment) {
            showAlert('Insira um valor de correção ou uma instrução/comentário.', 'warning');
            return;
        }
    }
    
    try {
        const data = await apiFetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                evaluation_id: currentEvalId,
                accepted: accepted ? 1 : 0,
                corrected_value: correctedValue ? parseFloat(correctedValue) : null,
                user_comment: comment || null,
                row: currentReviewRow,
                re_evaluate: reEvaluate
            })
        });
        if (data.status === 'ok') {
            if (reEvaluate) {
                showAlert('Feedback registrado! Re-avaliação concluída com aprendizado aplicado.', 'success');
            } else {
                showAlert(accepted ? 'Avaliação aceita!' : 'Feedback e correção enviados!', 'success');
            }
            closeReviewModal();
            loadSpreadsheetRowsForEvaluation();
            loadSpreadsheetRegistry();
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
        const res = await fetch(apiUrl('/api/evaluations'));
        const data = await res.json();
        
        if (data.status === 'ok') {
            if (data.evaluations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum ativo avaliado no histórico.</td></tr>';
                return;
            }
            
            const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
            
            tbody.innerHTML = '';
            data.evaluations.forEach((ev, idx) => {
                const rowEl = document.createElement('tr');
                rowEl.innerHTML = `
                    <td>#${ev.id}</td>
                    <td>${new Date(ev.created_at).toLocaleDateString('pt-BR')}</td>
                    <td title="${ev.asset_description}">${ev.asset_description.substring(0, 30)}...</td>
                    <td>${ev.methodology || '-'}</td>
                    <td>${fmtNum(ev.value_used)}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="openReviewModal(${ev.id}, '-', '-')">Revisar</button>
                    </td>
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

function loadGallerySidePanelDetails(ev) {
    document.getElementById('galleryActiveItem').textContent = `ID: ${ev.id}`;
    document.getElementById('galleryDescOriginal').textContent = ev.asset_description || 'Sem descrição';
    
    galleryPhotos = [];
    if (isValidPhotoUrl(ev.photo_url)) galleryPhotos.push({ url: ev.photo_url, type: 'Foto do Bem' });
    if (isValidPhotoUrl(ev.photo_spec)) galleryPhotos.push({ url: ev.photo_spec, type: 'Foto Especificações' });
    if (isValidPhotoUrl(ev.photo_tag)) galleryPhotos.push({ url: ev.photo_tag, type: 'Foto da TAG' });
    
    currentGalleryPhotoIndex = 0;
    updateGalleryPhotoUI();
    
    const fmtNum = (val) => val ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-';
    document.getElementById('galleryValueUsed').textContent = fmtNum(ev.value_used);
    document.getElementById('galleryValueNew').textContent = fmtNum(ev.value_new);
    document.getElementById('galleryValueFipe').textContent = fmtNum(ev.value_fipe);
    
    document.getElementById('galleryMethodology').textContent = ev.methodology || 'Não informada';
    document.getElementById('galleryReasoning').innerHTML = (ev.reasoning || '').replace(/\n/g, '<br>');
    
    if (ev.links) {
        const linksHtml = ev.links.split(',').map(l => `<a href="${l.trim()}" target="_blank" style="color: var(--afs-orange-400);">${l.trim()}</a>`).join('<br>');
        document.getElementById('galleryLinks').innerHTML = linksHtml;
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
        return;
    }
    
    const photoObj = sidePhotos[currentSidePhotoIndex];
    typeLabel.textContent = photoObj.type;
    img.src = photoObj.url;
    img.style.display = 'block';
    empty.style.display = 'none';
    prevBtn.disabled = sidePhotos.length <= 1;
    nextBtn.disabled = sidePhotos.length <= 1;
}

async function loadSidePanelDetails(evalId, row, control, photoUrl, photoSpec, photoTag, description) {
    currentSideRow = row;
    
    document.getElementById('sideActiveItem').textContent = `Controle: ${control || '-'}`;
    document.getElementById('sideDescOriginal').textContent = description || 'Sem descrição';
    
    // Set photos list using objects for proper categorization
    sidePhotos = [];
    if (isValidPhotoUrl(photoUrl)) sidePhotos.push({ url: photoUrl, type: 'Foto do Bem' });
    if (isValidPhotoUrl(photoSpec)) sidePhotos.push({ url: photoSpec, type: 'Foto Especificações' });
    if (isValidPhotoUrl(photoTag)) sidePhotos.push({ url: photoTag, type: 'Foto da TAG' });
    
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
        if (currentSideRow !== row) return;
        
        if (data.status === 'ok') {
            const ev = data.evaluation;
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
                raciocinio_visual: ev.reasoning
            });

            // Atualizar galeria com todas as fotos do registro
            sidePhotos = [];
            if (isValidPhotoUrl(ev.photo_url)) sidePhotos.push({ url: ev.photo_url, type: 'Foto do Bem' });
            if (isValidPhotoUrl(ev.photo_spec)) sidePhotos.push({ url: ev.photo_spec, type: 'Foto Especificações' });
            if (isValidPhotoUrl(ev.photo_tag)) sidePhotos.push({ url: ev.photo_tag, type: 'Foto da TAG' });
            if (sidePhotos.length === 0) {
                if (isValidPhotoUrl(photoUrl)) sidePhotos.push({ url: photoUrl, type: 'Foto do Bem' });
                if (isValidPhotoUrl(photoSpec)) sidePhotos.push({ url: photoSpec, type: 'Foto Especificações' });
                if (isValidPhotoUrl(photoTag)) sidePhotos.push({ url: photoTag, type: 'Foto da TAG' });
            }
            currentSidePhotoIndex = 0;
            updateSidePhotoUI();
            
            if (ev.links) {
                const linksHtml = ev.links.split(',').map(l => `<a href="${l.trim()}" target="_blank" style="color: var(--afs-orange-400);">${l.trim()}</a>`).join('<br>');
                document.getElementById('sideLinks').innerHTML = linksHtml;
            } else {
                document.getElementById('sideLinks').textContent = '-';
            }
        } else {
            document.getElementById('sideReasoning').textContent = 'Erro ao carregar dados: ' + data.message;
        }
    } catch (e) {
        if (currentSideRow !== row) return;
        document.getElementById('sideReasoning').textContent = 'Erro: ' + e.message;
    }
}

// ---------- Download & Spreadsheet Registry ----------
function downloadResults() {
    window.location.href = downloadFileUrl('/api/download-excel');
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
        const activateBtn = type === 'input' && !f.active
            ? `<button class="btn btn-secondary btn-sm" onclick="activateSpreadsheet('${f.name.replace(/'/g, "\\'")}')" title="Ativar">▶</button>`
            : '';
        const downloadBtn = type === 'output'
            ? `<a class="btn btn-secondary btn-sm" href="${downloadFileUrl('/api/download-output/' + encodeURIComponent(f.name))}" title="Download">⬇</a>`
            : '';
        return `<div class="registry-item${activeClass}">
            <span class="registry-item-name" title="${f.name}">${f.name}${f.active ? ' (ativa)' : ''}<br><small style="color:var(--text-muted)">${formatFileSize(f.size)} · ${date}</small></span>
            <div class="registry-item-actions">
                ${activateBtn}
                ${downloadBtn}
                <button class="btn btn-secondary btn-sm" onclick="deleteSpreadsheet('${type}', '${f.name.replace(/'/g, "\\'")}')" title="Excluir">🗑</button>
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
        await apiFetch(path, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        showAlert('Planilha removida.', 'success');
        loadSpreadsheetRegistry();
    } catch (e) {
        showAlert('Erro ao excluir: ' + e.message, 'error');
    }
}

async function activateSpreadsheet(filename) {
    try {
        await apiFetch('/api/spreadsheets/input/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        showAlert(`Planilha "${filename}" ativada.`, 'success');
        loadSpreadsheetRegistry();
        loadSessionState();
    } catch (e) {
        showAlert('Erro ao ativar: ' + e.message, 'error');
    }
}

