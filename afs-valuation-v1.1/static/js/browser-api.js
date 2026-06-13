// ============================================================
// AFS — Modo navegador (GitHub Pages sem backend Flask)
// ============================================================

const AFS_STORAGE_KEY = 'afs_local_state_v1_1';

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
            evaluated_rows: [],
            uploads: [],
            outputs: [],
            feedback: []
        };
    } catch {
        return { api_key: null, spreadsheet: null, column_mappings: {}, spreadsheet_mappings: {}, initialized: false, evaluations: [], evaluated_rows: [], uploads: [], outputs: [], feedback: [] };
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

function afsEnsureUsageState(s) {
    s.row_token_usage = s.row_token_usage || {};
    s.spreadsheet_usage_totals = s.spreadsheet_usage_totals || {};
}

function afsGetRowTokenUsage(s, spreadsheetName, rowIdx, evalObj) {
    const stored = s.row_token_usage?.[spreadsheetName]?.[rowIdx];
    if (stored) return stored;
    if (!evalObj) return null;
    return {
        tokens_total: evalObj.tokens_total ?? evalObj.tokens ?? 0,
        tokens_vision: evalObj.tokens_vision ?? 0,
        tokens_market: evalObj.tokens_market ?? 0,
        duration_ms: evalObj.duration_ms ?? 0,
        updated_at: evalObj.created_at || null
    };
}

function afsRecomputeSpreadsheetUsageTotals(s, spreadsheetName) {
    afsEnsureUsageState(s);
    if (!spreadsheetName) return;
    const spreadsheet = s.spreadsheet;
    const rowMap = s.row_token_usage[spreadsheetName] || {};
    const byRow = {};

    (s.evaluations || []).forEach(ev => {
        if (ev.row_index == null || byRow[ev.row_index] !== undefined) return;
        if (spreadsheet?.file_name === spreadsheetName) {
            if (!spreadsheet.rows?.some(r => r._row_index === ev.row_index)) return;
        }
        byRow[ev.row_index] = {
            tokens_total: ev.tokens_total ?? ev.tokens ?? 0,
            tokens_vision: ev.tokens_vision ?? 0,
            tokens_market: ev.tokens_market ?? 0,
            duration_ms: ev.duration_ms ?? 0,
            updated_at: ev.created_at || null
        };
    });

    Object.entries(rowMap).forEach(([k, v]) => {
        const idx = Number(k);
        if (!Number.isNaN(idx)) byRow[idx] = v;
    });

    let tokens_total = 0;
    let tokens_vision = 0;
    let tokens_market = 0;
    let total_duration_ms = 0;
    let item_count = 0;

    Object.values(byRow).forEach(u => {
        if (!u) return;
        const t = Number(u.tokens_total) || 0;
        if (t <= 0 && !u.duration_ms) return;
        tokens_total += t;
        tokens_vision += Number(u.tokens_vision) || 0;
        tokens_market += Number(u.tokens_market) || 0;
        total_duration_ms += Number(u.duration_ms) || 0;
        item_count++;
    });

    s.spreadsheet_usage_totals[spreadsheetName] = {
        tokens_total,
        tokens_vision,
        tokens_market,
        item_count,
        total_duration_ms,
        updated_at: new Date().toISOString()
    };
}

function afsRecordRowTokenUsage(s, spreadsheetName, rowIdx, payload) {
    if (!spreadsheetName || rowIdx == null) return;
    afsEnsureUsageState(s);
    const sheetRows = s.row_token_usage[spreadsheetName] || {};
    sheetRows[rowIdx] = {
        tokens_total: Number(payload.tokens_total) || 0,
        tokens_vision: Number(payload.tokens_vision) || 0,
        tokens_market: Number(payload.tokens_market) || 0,
        duration_ms: Number(payload.duration_ms) || 0,
        updated_at: payload.updated_at || new Date().toISOString()
    };
    s.row_token_usage[spreadsheetName] = sheetRows;
    afsRecomputeSpreadsheetUsageTotals(s, spreadsheetName);
}

function afsComputeUsageStats(s, spreadsheetName) {
    afsRecomputeSpreadsheetUsageTotals(s, spreadsheetName);
    const sheet = spreadsheetName ? s.spreadsheet_usage_totals?.[spreadsheetName] : null;
    const session = typeof window !== 'undefined' ? window.__afs_session_stats : null;
    const sheetAvg = sheet && sheet.item_count > 0 ? Math.round(sheet.tokens_total / sheet.item_count) : 0;
    const sessionAvg = session && session.item_count > 0 ? Math.round(session.tokens_total / session.item_count) : 0;

    const recent = [];
    const seen = new Set();
    (s.evaluations || []).forEach(ev => {
        if (ev.row_index == null || seen.has(ev.row_index)) return;
        seen.add(ev.row_index);
        const u = afsGetRowTokenUsage(s, spreadsheetName, ev.row_index, ev);
        recent.push({
            row_index: ev.row_index,
            control: ev.control,
            tokens_total: u?.tokens_total ?? 0,
            tokens_vision: u?.tokens_vision ?? 0,
            tokens_market: u?.tokens_market ?? 0,
            duration_ms: u?.duration_ms ?? 0,
            created_at: ev.created_at
        });
    });

    return {
        spreadsheet_name: spreadsheetName,
        sheet: sheet || { tokens_total: 0, tokens_vision: 0, tokens_market: 0, item_count: 0, total_duration_ms: 0 },
        sheet_avg_tokens: sheetAvg,
        session: session || { tokens_total: 0, tokens_vision: 0, tokens_market: 0, item_count: 0, total_duration_ms: 0 },
        session_avg_tokens: sessionAvg,
        recent_evaluations: recent.slice(0, 30)
    };
}

function afsInitSessionStats(spreadsheetName) {
    if (typeof window === 'undefined') return;
    window.__afs_session_stats = {
        spreadsheet: spreadsheetName || '',
        tokens_total: 0,
        tokens_vision: 0,
        tokens_market: 0,
        item_count: 0,
        total_duration_ms: 0
    };
}

function afsBumpSessionStats(payload, spreadsheetName) {
    if (typeof window === 'undefined') return;
    if (!window.__afs_session_stats) afsInitSessionStats(spreadsheetName);
    const st = window.__afs_session_stats;
    if (spreadsheetName && st.spreadsheet && st.spreadsheet !== spreadsheetName) {
        afsInitSessionStats(spreadsheetName);
    }
    if (spreadsheetName) st.spreadsheet = spreadsheetName;
    st.tokens_total += Number(payload.tokens_total) || 0;
    st.tokens_vision += Number(payload.tokens_vision) || 0;
    st.tokens_market += Number(payload.tokens_market) || 0;
    st.total_duration_ms += Number(payload.duration_ms) || 0;
    st.item_count += 1;
}

// UI select value → API model id (IDs bare often 404 on v1beta REST)
const AFS_GEMINI_MODEL_REGISTRY = {
    'gemini-1.5-flash': {
        apiId: 'gemini-1.5-flash-latest',
        fallbacks: ['gemini-1.5-flash-8b', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'],
        label: 'Gemini 1.5 Flash',
        costTier: 'low'
    },
    'gemini-1.5-pro': {
        apiId: 'gemini-1.5-pro-latest',
        fallbacks: ['gemini-1.5-pro', 'gemini-2.5-pro', 'gemini-2.5-flash'],
        label: 'Gemini 1.5 Pro'
    },
    'gemini-2.0-flash': {
        apiId: 'gemini-2.0-flash',
        fallbacks: ['gemini-2.5-flash'],
        label: 'Gemini 2.0 Flash'
    },
    'gemini-2.5-flash': {
        apiId: 'gemini-2.5-flash',
        fallbacks: [],
        label: 'Gemini 2.5 Flash'
    },
    'gemini-2.5-pro': {
        apiId: 'gemini-2.5-pro',
        fallbacks: ['gemini-2.5-flash'],
        label: 'Gemini 2.5 Pro'
    },
    'gemini-3.1-pro': {
        apiId: 'gemini-3.1-pro-preview',
        fallbacks: ['gemini-2.5-pro', 'gemini-2.5-flash'],
        label: 'Gemini 3.1 Pro',
        thinkingLevel: 'low'
    },
    'gemini-3.5-flash': {
        apiId: 'gemini-3.5-flash',
        fallbacks: ['gemini-2.5-flash'],
        label: 'Gemini 3.5 Flash',
        thinkingLevel: 'low'
    }
};

const AFS_PROMPT_CACHE_MIN_TOKENS = 2048;
const _afsPromptCacheMemory = {};

function afsResolveGeminiModelByApiId(apiId) {
    for (const [uiId, entry] of Object.entries(AFS_GEMINI_MODEL_REGISTRY)) {
        if (entry.apiId === apiId) return { uiId, ...entry };
    }
    return { uiId: apiId, apiId, fallbacks: [], label: apiId };
}

function afsResolveGeminiModel(uiModel) {
    const key = uiModel && AFS_GEMINI_MODEL_REGISTRY[uiModel] ? uiModel : 'gemini-1.5-flash';
    return { uiId: key, ...AFS_GEMINI_MODEL_REGISTRY[key] };
}

function afsIsGeminiModelError(msg) {
    const m = String(msg || '').toLowerCase();
    return m.includes('not found') || m.includes('not supported') || m.includes('404')
        || m.includes('is not supported for generatecontent');
}

function afsIsJsonModeError(msg) {
    const m = String(msg || '').toLowerCase();
    return m.includes('responsemimetype') || m.includes('response mime')
        || (m.includes('json') && m.includes('not supported'));
}

function afsEstimateTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

function afsPromptCacheHash(text) {
    let h = 0;
    const s = String(text);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

async function afsCreateExplicitPromptCache(apiKey, apiModel, slot, staticText) {
    if (afsEstimateTokens(staticText) < AFS_PROMPT_CACHE_MIN_TOKENS) return null;

    const hash = afsPromptCacheHash(staticText);
    const memKey = `${apiModel}::${slot}::${hash}`;
    const now = Date.now();
    const cached = _afsPromptCacheMemory[memKey];
    if (cached && cached.expiresAt > now + 120000) return cached.name;

    const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${encodeURIComponent(apiKey)}`;
    const body = {
        model: `models/${apiModel}`,
        contents: [{ role: 'user', parts: [{ text: staticText }] }],
        ttl: '3600s',
        displayName: `afs-${slot}-${apiModel}-${hash}`
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        console.warn('[AFS] explicit prompt cache failed:', data.error?.message || res.statusText);
        return null;
    }
    const name = data.name;
    if (!name) return null;
    const expireTime = data.expireTime ? new Date(data.expireTime).getTime() : now + 3600000;
    _afsPromptCacheMemory[memKey] = { name, expiresAt: expireTime };
    return name;
}

async function afsPrepareCachedGeminiCall(apiKey, uiModel, slot, staticText, dynamicParts) {
    const resolved = afsResolveGeminiModel(uiModel);
    const cacheName = await afsCreateExplicitPromptCache(apiKey, resolved.apiId, slot, staticText);
    const opts = { cacheSlot: slot, staticText };
    if (cacheName) {
        return { parts: dynamicParts, opts: { ...opts, cachedContent: cacheName } };
    }
    // Implicit caching (2.5+): prefixo estável antes do conteúdo variável
    return { parts: [{ text: staticText }, ...dynamicParts], opts };
}

function afsGeminiModelLabel(uiModel) {
    return afsResolveGeminiModel(uiModel).label || uiModel;
}

function afsBuildModelFallbackWarning(res, phaseLabel) {
    if (!res?.isFallback) return null;
    const wantedLabel = afsGeminiModelLabel(res.requestedModel || res.uiModel);
    const wantedApi = res.resolvedApiId || afsResolveGeminiModel(res.requestedModel).apiId;
    const usedApi = res.apiModel || res.fallbackModel || '';
    return `${phaseLabel}: selecionado ${wantedLabel} (${wantedApi}) → API usou ${usedApi} (tokens podem custar mais).`;
}

function afsAnnotateGeminiResult(result, resolved, apiModel, attemptIndex) {
    result.resolvedApiId = resolved.apiId;
    result.apiModel = apiModel;
    result.isFallback = attemptIndex > 0 || apiModel !== resolved.apiId;
    result.uiModel = resolved.uiId;
    result.requestedModel = resolved.uiId;
    if (result.isFallback) result.fallbackModel = apiModel;
    return result;
}

function afsBuildGenerationConfig(jsonMode, modelEntry) {
    const gen = {};
    if (jsonMode) {
        gen.responseMimeType = 'application/json';
        gen.temperature = 0.3;
    } else {
        gen.maxOutputTokens = 20;
        gen.temperature = 0;
    }
    if (modelEntry?.thinkingLevel) {
        gen.thinkingConfig = { thinkingLevel: modelEntry.thinkingLevel };
    }
    return gen;
}

async function afsGeminiRequestOnce(apiKey, apiModel, modelEntry, parts, jsonMode, opts = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
        contents: [{ parts }],
        generationConfig: afsBuildGenerationConfig(jsonMode, modelEntry)
    };
    if (opts.cachedContent) body.cachedContent = opts.cachedContent;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || res.statusText);
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};
    return {
        text,
        tokens: usage.totalTokenCount || 0,
        cachedTokens: usage.cachedContentTokenCount || 0,
        raw: data,
        apiModel
    };
}

async function afsGeminiRequest(apiKey, model, parts, jsonMode = true, opts = {}) {
    const resolved = afsResolveGeminiModel(model);
    const modelsToTry = [resolved.apiId, ...resolved.fallbacks];
    let lastError = null;

    for (let i = 0; i < modelsToTry.length; i++) {
        const apiModel = modelsToTry[i];
        const modelEntry = i === 0 ? resolved : afsResolveGeminiModelByApiId(apiModel);

        let cachedContent = opts.cachedContent;
        if (opts.cacheSlot && opts.staticText) {
            if (i > 0 || !cachedContent) {
                cachedContent = await afsCreateExplicitPromptCache(apiKey, apiModel, opts.cacheSlot, opts.staticText) || undefined;
            }
        }
        const requestOpts = { ...opts, cachedContent };

        try {
            const result = afsAnnotateGeminiResult(
                await afsGeminiRequestOnce(apiKey, apiModel, modelEntry, parts, jsonMode, requestOpts),
                resolved, apiModel, i
            );
            return result;
        } catch (e) {
            lastError = e;
            if (jsonMode && afsIsJsonModeError(e.message)) {
                try {
                    const result = afsAnnotateGeminiResult(
                        await afsGeminiRequestOnce(apiKey, apiModel, modelEntry, parts, false, requestOpts),
                        resolved, apiModel, i
                    );
                    return result;
                } catch (e2) {
                    lastError = e2;
                }
            }
            if (afsIsGeminiModelError(lastError.message) && i < modelsToTry.length - 1) {
                console.warn(`[AFS] modelo ${apiModel} falhou, tentando fallback...`, lastError.message);
                continue;
            }
            throw lastError;
        }
    }
    throw lastError || new Error('Falha na chamada Gemini');
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
                const buildRow = (row, i) => {
                    const obj = { _row_index: headerRow + 1 + i };
                    // Mapear por índice REAL da coluna (h.index-1), não pela posição filtrada
                    headers.forEach(h => { obj[h.letter] = row[h.index - 1] ?? null; });
                    return obj;
                };
                const preview = dataRows.slice(0, 5).map(buildRow);
                const allRows = dataRows.map(buildRow);
                const photoLookups = typeof afsBuildAllPhotoLookups === 'function'
                    ? afsBuildAllPhotoLookups(wb)
                    : { bem: {}, spec: {}, tag: {}, _meta: { sheets: {}, counts: {} } };
                const meta = photoLookups._meta || {};
                const photoCount = (meta.counts?.bem || 0) + (meta.counts?.spec || 0) + (meta.counts?.tag || 0);
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
                    file_name: file.name,
                    photo_lookups: { bem: photoLookups.bem, spec: photoLookups.spec, tag: photoLookups.tag },
                    photo_lookup_meta: meta,
                    photo_lookup: { ...(photoLookups.bem || {}), ...(photoLookups.spec || {}), ...(photoLookups.tag || {}) },
                    photo_count: photoCount
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
        tag_output: { label: 'Número da Tag (DESTINO / IA)', description: 'Coluna mapeada para o número lido na foto (ou "não foi possível verificar")' },
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
        photo_original: { label: 'Foto do Bem (quantidade)', description: 'Coluna com a QUANTIDADE de fotos do bem (ex: 2) — não é URL' },
        photo_spec: { label: 'Foto Especificações (quantidade)', description: 'Coluna com a QUANTIDADE de fotos de especificações' },
        photo_tag: { label: 'Foto da TAG (quantidade)', description: 'Coluna com a QUANTIDADE de fotos da plaqueta/tag' }
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
        const testModel = body?.model || 'gemini-1.5-flash';
        const resolved = afsResolveGeminiModel(testModel);
        try {
            const ping = await afsGeminiRequest(s.api_key, testModel, [{ text: 'Responda apenas: ok' }], false);
            const used = ping.apiModel || ping.fallbackModel || resolved.apiId;
            const label = resolved.label || testModel;
            if (ping.isFallback) {
                const warn = afsBuildModelFallbackWarning(ping, 'Teste de conexão');
                return {
                    gemini: { status: 'warning', message: warn || `Fallback: ${used} (selecionado: ${label})`, model_fallback: true, model_used: used, model_requested: testModel },
                    search: { status: 'warning', message: warn || 'Modelo alternativo na API' },
                    vision: { status: 'warning', message: warn || 'Modelo alternativo na API' }
                };
            }
            const okMsg = `Conectado: ${label} (${used})`;
            const ok = { status: 'ok', message: okMsg, model_used: used, model_requested: testModel };
            return { gemini: ok, search: { status: 'ok', message: 'Search via Gemini (modo navegador)' }, vision: { status: 'ok', message: 'Vision via Gemini (modo navegador)' } };
        } catch (e) {
            const err = { status: 'error', message: `${resolved.label}: ${e.message}`, model_requested: testModel };
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
        const mappings = afsGetActiveMappings(s);
        const rows = typeof afsResolveAllRowsPhotos === 'function'
            ? afsResolveAllRowsPhotos(s.spreadsheet, mappings)
            : (s.spreadsheet.rows || []);
        return { status: 'ok', rows, photo_lookup: s.spreadsheet.photo_lookup || {}, photo_lookups: s.spreadsheet.photo_lookups || {}, photo_lookup_meta: s.spreadsheet.photo_lookup_meta || {} };
    }

    if (path === '/api/spreadsheets/input' && method === 'GET') {
        const files = (s.uploads || []).map(u => ({ name: u.name, size: u.size, modified: u.modified, active: s.spreadsheet?.file_name === u.name }));
        return { status: 'ok', files };
    }

    if (path === '/api/spreadsheets/input' && method === 'DELETE') {
        const filename = body?.filename;
        if (!filename) return { status: 'error', message: 'Nome do arquivo não informado' };
        s.uploads = (s.uploads || []).filter(u => u.name !== filename);
        if (s.spreadsheet_mappings) delete s.spreadsheet_mappings[filename];
        if (s.spreadsheet?.file_name === filename) {
            s.spreadsheet = null;
            s.column_mappings = {};
            s.initialized = false;
            if (s.uploads.length > 0) {
                const next = s.uploads[0];
                s.spreadsheet = next.data;
                s.column_mappings = (s.spreadsheet_mappings || {})[next.name] || {};
            }
        }
        afsSaveState(s);
        return { status: 'ok', message: `Planilha ${filename} removida` };
    }

    if (path === '/api/spreadsheets/output' && method === 'GET') {
        return { status: 'ok', files: s.outputs || [] };
    }

    if (path === '/api/spreadsheets/output' && method === 'DELETE') {
        const filename = body?.filename;
        if (!filename) return { status: 'error', message: 'Nome do arquivo não informado' };
        s.outputs = (s.outputs || []).filter(o => o.name !== filename);
        afsSaveState(s);
        return { status: 'ok', message: `Output ${filename} removido` };
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
        s.initialized = false;
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

    if (path === '/api/evaluated-rows' && method === 'GET') {
        return { status: 'ok', rows: s.evaluated_rows || [] };
    }

    if (path === '/api/feedback' && method === 'POST') {
        const evaluationId = body?.evaluation_id;
        const accepted = Boolean(body?.accepted);
        const correctedValue = body?.corrected_value;
        const userComment = body?.user_comment || '';
        const rowIdx = body?.row;
        const reEvaluate = Boolean(body?.re_evaluate);

        s.feedback = s.feedback || [];
        s.feedback.push({ ...body, at: Date.now() });

        const evIdx = (s.evaluations || []).findIndex(e => e.id === evaluationId);
        const ev = evIdx >= 0 ? s.evaluations[evIdx] : null;

        if (ev && accepted && rowIdx) {
            afsMarkRowEvaluated(s, parseInt(rowIdx, 10));
        }

        if (ev && !accepted) {
            s.auto_aprendizados = s.auto_aprendizados || [];
            s.auto_aprendizados.push({
                descricao_bem: ev.asset_description,
                feedback_usuario: userComment,
                valor_correto: correctedValue,
                data: new Date().toISOString()
            });

            if (reEvaluate && rowIdx && typeof browserReEvaluateRow === 'function') {
                try {
                    const reResult = await browserReEvaluateRow({
                        rowIdx: parseInt(rowIdx, 10),
                        evaluationId,
                        userComment,
                        correctedValue,
                        model: body?.model || 'gemini-1.5-flash'
                    });
                    afsSaveState(s);
                    return { status: 'ok', re_evaluate: reResult, evaluation: reResult?.evaluation };
                } catch (err) {
                    return { status: 'error', message: err.message || String(err) };
                }
            }

            if (correctedValue != null && !Number.isNaN(Number(correctedValue))) {
                ev.value_used = Number(correctedValue);
            }

            const mappings = afsGetActiveMappings(s);
            const link1Letter = mappings.link1;
            if (link1Letter && s.spreadsheet?.rows) {
                const rowData = s.spreadsheet.rows.find(r => r._row_index === parseInt(rowIdx, 10));
                if (rowData) rowData[link1Letter] = '';
            }
        }

        afsSaveState(s);
        return { status: 'ok', evaluation: ev };
    }

    if (path === '/api/pause-evaluation' && method === 'POST') {
        window.__afs_eval_paused = true;
        return { status: 'ok' };
    }

    if (path === '/api/learning-rules' && method === 'GET') {
        const rules = s.learning_rules_text || (typeof AFS_DEFAULT_LEARNING_RULES !== 'undefined' ? AFS_DEFAULT_LEARNING_RULES : '');
        return { status: 'ok', rules };
    }

    if (path === '/api/learning-rules' && method === 'POST') {
        s.learning_rules_text = body?.rules || '';
        afsSaveState(s);
        return { status: 'ok' };
    }

    if (path === '/api/learnings' && method === 'GET') {
        const rulesText = s.learning_rules_text || (typeof AFS_DEFAULT_LEARNING_RULES !== 'undefined' ? AFS_DEFAULT_LEARNING_RULES : '');
        const formatted = typeof afsFormatLearningsList === 'function'
            ? afsFormatLearningsList(s.feedback || [], s.auto_aprendizados || [], rulesText)
            : '';
        return { status: 'ok', formatted };
    }

    if (path === '/api/usage-stats' && method === 'GET') {
        const name = afsActiveSpreadsheetName(s);
        return { status: 'ok', stats: afsComputeUsageStats(s, name) };
    }

    if (path === '/api/download-excel' && method === 'GET') {
        try {
            browserExportSpreadsheet();
            return { status: 'ok' };
        } catch (e) {
            return { status: 'error', message: e.message || String(e) };
        }
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
    s.initialized = false;
    window.__afs_eval_paused = false;
    afsSaveState(s);
    return parsed;
}

function afsMarkRowEvaluated(s, rowIdx) {
    if (rowIdx == null) return;
    const idx = parseInt(rowIdx, 10);
    s.evaluated_rows = s.evaluated_rows || [];
    if (!s.evaluated_rows.includes(idx)) s.evaluated_rows.push(idx);
}

function afsIsRowPendingEvaluation(row, s, mappings) {
    const rowIdx = row._row_index;
    const evaluatedSet = new Set(s.evaluated_rows || []);
    if (evaluatedSet.has(rowIdx)) return false;
    const hasEval = (s.evaluations || []).some(e => e.row_index === rowIdx);
    if (hasEval) return false;
    const link1Letter = mappings.link1;
    const link1Val = link1Letter ? row[link1Letter] : null;
    if (link1Val != null && String(link1Val).trim() !== '') return false;
    return true;
}

function afsApplyEvaluationToRow(row, ev, mappings) {
    if (!row || !ev || !mappings) return;
    const letter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };
    const set = (field, val) => {
        const l = letter(field);
        if (!l) return;
        if (val === null || val === undefined || val === '') return;
        row[l] = val;
    };
    set('asset_output', ev.asset_normalized);
    set('category_output', ev.category_normalized);
    set('value_used', ev.value_used);
    set('value_new', ev.value_new);
    set('value_fipe', ev.value_fipe);
    set('methodology', ev.methodology);
    set('age_output', ev.apparent_age);
    let cons = ev.conservation_state;
    if (cons != null && ev.apparent_age != null && typeof afsAlignConservationWithAge === 'function') {
        cons = afsAlignConservationWithAge(ev.apparent_age, cons);
    }
    set('conservation_output', cons);
    const tagOutCol = letter('tag_output');
    const tagOrigCol = letter('tag_original');
    if (tagOutCol && tagOrigCol && tagOutCol === tagOrigCol) {
        console.warn('[AFS] tag_output e tag_original na mesma coluna — tag da IA não gravada');
    } else {
        set('tag_output', ev.tag_verified);
    }
    const linkParts = (ev.links_array && ev.links_array.length)
        ? ev.links_array
        : String(ev.links || '').split(',').map(x => x.trim()).filter(x => /^https?:\/\//i.test(x));
    const l1 = letter('link1');
    if (l1 && linkParts[0]) row[l1] = linkParts[0];
    const l2 = letter('link2');
    if (l2 && linkParts[1]) row[l2] = linkParts[1];
    const descOut = letter('desc_output');
    if (descOut) {
        const txt = [ev.asset_description, ev.reasoning].filter(Boolean).join('\n\n');
        if (txt) row[descOut] = txt;
    }
}

function browserExportSpreadsheet() {
    const s = afsLoadState();
    if (!s.spreadsheet?.rows?.length) throw new Error('Nenhuma planilha carregada');
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca XLSX não carregada');
    const spreadsheet = s.spreadsheet;
    const mappings = afsGetActiveMappings(s);
    const evalByRow = {};
    const evalByControl = {};
    (s.evaluations || []).forEach(ev => {
        if (ev.row_index != null && evalByRow[ev.row_index] === undefined) {
            evalByRow[ev.row_index] = ev;
        }
        if (ev.control != null && String(ev.control).trim() !== '' && evalByControl[ev.control] === undefined) {
            evalByControl[String(ev.control).trim()] = ev;
        }
    });
    const headers = spreadsheet.headers || [];
    const headerNames = headers.map(h => h.name || h.letter);
    const controlLetter = (() => {
        const m = mappings.control;
        return typeof m === 'string' ? m : m?.letter || '';
    })();
    const dataRows = spreadsheet.rows.map(srcRow => {
        const row = { ...srcRow };
        let ev = evalByRow[srcRow._row_index];
        if (!ev && controlLetter && srcRow[controlLetter] != null) {
            ev = evalByControl[String(srcRow[controlLetter]).trim()];
        }
        if (ev) afsApplyEvaluationToRow(row, ev, mappings);
        return headers.map(h => row[h.letter] ?? '');
    });
    const ws = XLSX.utils.aoa_to_sheet([headerNames, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    const baseName = (spreadsheet.file_name || 'planilha').replace(/\.xlsx?$/i, '');
    XLSX.writeFile(wb, `${baseName}-afs-resultado.xlsx`);
}

window.afsMarkRowEvaluated = afsMarkRowEvaluated;
window.afsIsRowPendingEvaluation = afsIsRowPendingEvaluation;
window.afsApplyEvaluationToRow = afsApplyEvaluationToRow;
window.browserExportSpreadsheet = browserExportSpreadsheet;
window.afsRecordRowTokenUsage = afsRecordRowTokenUsage;
window.afsGetRowTokenUsage = afsGetRowTokenUsage;
window.afsComputeUsageStats = afsComputeUsageStats;
window.afsBumpSessionStats = afsBumpSessionStats;
window.afsInitSessionStats = afsInitSessionStats;
window.afsRecomputeSpreadsheetUsageTotals = afsRecomputeSpreadsheetUsageTotals;
window.browserHandleUpload = browserHandleUpload;
window.afsLoadState = afsLoadState;
window.afsGeminiRequest = afsGeminiRequest;
window.afsResolveGeminiModel = afsResolveGeminiModel;
window.afsPrepareCachedGeminiCall = afsPrepareCachedGeminiCall;
window.afsBuildModelFallbackWarning = afsBuildModelFallbackWarning;
window.afsGeminiModelLabel = afsGeminiModelLabel;
