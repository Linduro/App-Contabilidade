// ============================================================
// AFS — Modo navegador (GitHub Pages sem backend Flask)
// ============================================================

const AFS_STORAGE_KEY = 'afs_local_state_v1';

function afsLoadState() {
    try {
        const raw = localStorage.getItem(AFS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {
            api_key: null,
            spreadsheet: null,
            column_mappings: {},
            spreadsheet_mappings: {},
            initialized: false,
            evaluations: [],
            uploads: [],
            outputs: [],
            feedback: []
        };
    } catch {
        return { api_key: null, spreadsheet: null, column_mappings: {}, spreadsheet_mappings: {}, initialized: false, evaluations: [], uploads: [], outputs: [], feedback: [] };
    }
}

function afsSaveState(s) {
    localStorage.setItem(AFS_STORAGE_KEY, JSON.stringify(s));
}

function afsActiveSpreadsheetName(s) {
    return s.spreadsheet?.file_name || null;
}

function afsGetActiveMappings(s) {
    const name = afsActiveSpreadsheetName(s);
    if (name && s.spreadsheet_mappings?.[name]) return s.spreadsheet_mappings[name];
    return s.column_mappings || {};
}

function afsSaveMappings(s, mappings, spreadsheetName) {
    const name = spreadsheetName || afsActiveSpreadsheetName(s);
    s.column_mappings = mappings;
    if (name) {
        s.spreadsheet_mappings = s.spreadsheet_mappings || {};
        s.spreadsheet_mappings[name] = mappings;
    }
}

async function afsGeminiRequest(apiKey, model, parts, jsonMode = true) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
        contents: [{ parts }],
        generationConfig: jsonMode ? { responseMimeType: 'application/json', temperature: 0.3 } : { maxOutputTokens: 20, temperature: 0 }
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        const msg = data.error?.message || res.statusText;
        throw new Error(msg);
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = data.usageMetadata?.totalTokenCount || 0;
    return { text, tokens, raw: data };
}

function afsParseWorkbook(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const sheetNames = wb.SheetNames.filter(n => !/^(foto do bem|historico|histórico|config)/i.test(n.trim()));
                let bestIdx = 0;
                let maxCells = -1;
                sheetNames.forEach((name, i) => {
                    const ws = wb.Sheets[name];
                    const cells = (ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { e: { r: 0, c: 0 } });
                    const count = (cells.e.r + 1) * (cells.e.c + 1);
                    if (count > maxCells) { maxCells = count; bestIdx = i; }
                });
                const sheetName = sheetNames[bestIdx] || wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
                let headerRow = 1;
                let bestScore = 0;
                for (let r = 0; r < Math.min(20, rows.length); r++) {
                    const score = (rows[r] || []).filter(c => c != null && String(c).trim()).length;
                    if (score > bestScore) { bestScore = score; headerRow = r + 1; }
                }
                const headerCells = rows[headerRow - 1] || [];
                const headers = headerCells.map((name, idx) => ({
                    letter: XLSX.utils.encode_col(idx),
                    index: idx + 1,
                    name: name != null ? String(name).trim() : ''
                })).filter(h => h.name);
                const dataRows = rows.slice(headerRow).filter(r => r && r.some(c => c != null && String(c).trim()));
                const preview = dataRows.slice(0, 5).map((row, i) => {
                    const obj = { _row_index: headerRow + 1 + i };
                    headers.forEach((h, ci) => { obj[h.letter] = row[ci] ?? null; });
                    return obj;
                });
                const allRows = dataRows.map((row, i) => {
                    const obj = { _row_index: headerRow + 1 + i };
                    headers.forEach((h, ci) => { obj[h.letter] = row[ci] ?? null; });
                    return obj;
                });
                resolve({
                    status: 'ok',
                    headers,
                    preview,
                    preview_rows: preview,
                    rows: allRows,
                    total_rows: allRows.length,
                    header_row: headerRow,
                    sheet_names: wb.SheetNames,
                    best_sheet_idx: wb.SheetNames.indexOf(sheetName),
                    file_name: file.name
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsArrayBuffer(file);
    });
}

const AFS_FIELDS = {
    required: {
        tag_original: { label: 'Número da Tag (ORIGEM)', description: 'Coluna com a tag original colhida na vistoria' },
        tag_output: { label: 'Número da Tag (DESTINO / IA)', description: "Coluna para gravar o 'ok' ou novo número da foto" },
        link1: { label: 'Link 1 (Destino)', description: 'Coluna para gravar o primeiro link de referência' },
        link2: { label: 'Link 2 (Destino)', description: 'Coluna para gravar o segundo link de referência' },
        desc_original: { label: 'Descrição (ORIGEM)', description: 'Coluna com a descrição original da vistoria' },
        desc_output: { label: 'Descrição e Reasoning (DESTINO / IA)', description: 'Ex: Coluna BC - Descrição + Raciocínio' },
        methodology: { label: 'Metodologia de Avaliação', description: 'Coluna para gravar a metodologia utilizada' },
        value_new: { label: 'Valor de Novo', description: 'Coluna para gravar o valor do bem novo' },
        value_used: { label: 'Valor de Usado / Comparativo Direto', description: 'Coluna para gravar o valor de mercado usado' },
        value_fipe: { label: 'Valor FIPE', description: 'Coluna para gravar o valor da tabela FIPE (veículos)' },
        age_original: { label: 'Idade Aparente (ORIGEM)', description: 'Coluna com a idade coletada na vistoria' },
        age_output: { label: 'Idade Aparente (DESTINO / IA)', description: 'Coluna para gravar a validação da idade pela foto' },
        conservation_original: { label: 'Estado de Conservação (ORIGEM)', description: 'Coluna com a conservação coletada na vistoria' },
        conservation_output: { label: 'Estado de Conservação (DESTINO / IA)', description: 'Coluna para gravar a validação da conservação pela foto' }
    },
    optional: {
        control: { label: 'ID de Controle (Principal)', description: 'Coluna de identificação única do item na planilha' },
        asset_output: { label: 'Ativo (DESTINO / IA)', description: 'Coluna para gravar o nome simplificado do bem (ex: cadeira, mesa)' },
        category_output: { label: 'Categoria (DESTINO / IA)', description: 'Coluna para gravar a categoria ampla (ex: mobiliário, TI)' },
        photo_original: { label: 'Foto do Ativo', description: 'Coluna com o link da imagem original da vistoria' },
        photo_spec: { label: 'Foto Especificações', description: 'Coluna com o link da foto de especificações do bem' },
        photo_tag: { label: 'Foto da TAG', description: 'Coluna com o link da foto da plaqueta/tag do bem' }
    }
};

async function browserApiFetch(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    const s = afsLoadState();

    if (path === '/api/set-key' && method === 'POST') {
        s.api_key = body.api_key;
        afsSaveState(s);
        return { status: 'ok', message: 'Chave configurada (modo navegador)' };
    }

    if (path === '/api/test-keys' && method === 'POST') {
        if (!s.api_key) return { gemini: { status: 'error', message: 'Chave não configurada' }, search: { status: 'error', message: 'Chave não configurada' }, vision: { status: 'error', message: 'Chave não configurada' } };
        try {
            await afsGeminiRequest(s.api_key, 'gemini-2.5-flash', [{ text: 'Responda apenas: ok' }], false);
            const ok = { status: 'ok', message: 'Conectado (modo navegador)' };
            return { gemini: ok, search: { status: 'ok', message: 'Search via Gemini (modo navegador)' }, vision: { status: 'ok', message: 'Vision via Gemini (modo navegador)' } };
        } catch (e) {
            const err = { status: 'error', message: e.message };
            return { gemini: err, search: err, vision: err };
        }
    }

    if (path === '/api/session-state' && method === 'GET') {
        const mappings = afsGetActiveMappings(s);
        const session = {
            has_api_key: Boolean(s.api_key),
            has_spreadsheet: Boolean(s.spreadsheet),
            has_mappings: Boolean(Object.keys(mappings).length),
            initialized: s.initialized,
            column_mappings: mappings,
            active_spreadsheet: afsActiveSpreadsheetName(s)
        };
        if (s.spreadsheet) session.spreadsheet_preview = s.spreadsheet;
        return session;
    }

    if (path === '/api/fields' && method === 'GET') {
        return AFS_FIELDS;
    }

    if (path === '/api/column-mappings' && method === 'POST') {
        const name = body.spreadsheet_name || afsActiveSpreadsheetName(s);
        afsSaveMappings(s, body.mappings || {}, name);
        afsSaveState(s);
        return { status: 'ok', message: `Mapeamentos salvos${name ? ' para ' + name : ''}` };
    }

    if (path === '/api/finalize-init' && method === 'POST') {
        const issues = [];
        if (!s.api_key) issues.push('Chave de API não configurada');
        if (!s.spreadsheet) issues.push('Planilha não carregada');
        if (!Object.keys(afsGetActiveMappings(s)).length) issues.push('Mapeamento não definido');
        if (issues.length) return { status: 'incomplete', issues, message: `${issues.length} item(ns) pendente(s)` };
        s.initialized = true;
        afsSaveState(s);
        return { status: 'ok', message: 'Sistema inicializado (modo navegador)' };
    }

    if (path === '/api/spreadsheet-data' && method === 'GET') {
        if (!s.spreadsheet) return { status: 'error', message: 'Nenhuma planilha carregada' };
        return { status: 'ok', rows: s.spreadsheet.rows };
    }

    if (path === '/api/spreadsheets/input' && method === 'GET') {
        const files = (s.uploads || []).map(u => ({ name: u.name, size: u.size, modified: u.modified, active: s.spreadsheet?.file_name === u.name }));
        return { status: 'ok', files };
    }

    if (path === '/api/spreadsheets/output' && method === 'GET') {
        return { status: 'ok', files: s.outputs || [] };
    }

    if (path === '/api/spreadsheets/input/activate' && method === 'POST') {
        const filename = body?.filename;
        if (!filename) return { status: 'error', message: 'Nome do arquivo não informado' };
        const entry = (s.uploads || []).find(u => u.name === filename);
        let sheetData = entry?.data || null;
        if (!sheetData && s.spreadsheet?.file_name === filename) sheetData = s.spreadsheet;
        if (!sheetData) {
            return { status: 'error', message: 'Dados da planilha indisponíveis. Envie o arquivo novamente.' };
        }
        s.spreadsheet = sheetData;
        const saved = (s.spreadsheet_mappings || {})[filename];
        s.column_mappings = saved || {};
        afsSaveState(s);
        return { status: 'ok', message: `Planilha ${filename} ativada`, preview: sheetData, column_mappings: s.column_mappings };
    }

    if (path.startsWith('/api/evaluation/') && method === 'GET') {
        const id = parseInt(path.split('/').pop(), 10);
        const ev = (s.evaluations || []).find(e => e.id === id);
        if (!ev) return { status: 'error', message: 'Avaliação não encontrada' };
        return { status: 'ok', evaluation: ev };
    }

    if (path === '/api/evaluations' && method === 'GET') {
        return { status: 'ok', evaluations: s.evaluations || [] };
    }

    if (path === '/api/feedback' && method === 'POST') {
        s.feedback = s.feedback || [];
        s.feedback.push({ ...body, at: Date.now() });
        afsSaveState(s);
        return { status: 'ok' };
    }

    if (path === '/api/pause-evaluation' && method === 'POST') {
        window.__afs_eval_paused = true;
        return { status: 'ok' };
    }

    return { status: 'error', message: `Rota não suportada no modo navegador: ${path}` };
}

async function browserHandleUpload(file) {
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca XLSX não carregada');
    const parsed = await afsParseWorkbook(file);
    const s = afsLoadState();
    s.spreadsheet = parsed;
    s.uploads = s.uploads || [];
    s.uploads = s.uploads.filter(u => u.name !== file.name);
    s.uploads.unshift({ name: file.name, size: file.size, modified: Date.now() / 1000, data: parsed });
    if (!(s.spreadsheet_mappings || {})[file.name]) {
        s.spreadsheet_mappings = s.spreadsheet_mappings || {};
        s.spreadsheet_mappings[file.name] = {};
    }
    s.column_mappings = s.spreadsheet_mappings[file.name];
    afsSaveState(s);
    return parsed;
}

window.browserApiFetch = browserApiFetch;
window.browserHandleUpload = browserHandleUpload;
window.afsLoadState = afsLoadState;
window.afsGeminiRequest = afsGeminiRequest;
