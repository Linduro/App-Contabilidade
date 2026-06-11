// ============================================================
// AFS — Avaliação client-side (GitHub Pages / modo navegador)
// ============================================================

const AFS_VISION_PROMPT = `Analise as imagens do ativo e retorne APENAS JSON válido:
{
  "tag_encontrada": "string ou null",
  "idade_aparente_anos": number ou null,
  "estado_conservacao": 1-5 ou null,
  "raciocinio_visual": "breve explicação"
}`;

const AFS_VALUATION_PROMPT = `Você é avaliador de ativos imobilizados. Retorne APENAS JSON:
{
  "categoria": "categoria ampla (ex: mobiliário, TI, veículos)",
  "ativo": "nome curto padronizado em minúsculas (ex: cadeira, mesa)",
  "descricao_identificacao": "descrição melhorada",
  "metodologia": "metodologia usada",
  "valor_novo": number ou null,
  "valor_usado": number ou null,
  "valor_fipe": number ou null,
  "links_comparativos": ["urls"],
  "raciocinio_detalhado": "passo a passo"
}`;

function normalizePhotoUrl(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') {
        if (raw.Target) return String(raw.Target).trim();
        if (raw.l) return String(raw.l).trim();
        if (raw.text) return normalizePhotoUrl(raw.text);
    }
    let s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith('=') && /HYPERLINK/i.test(s)) {
        const m = s.match(/HYPERLINK\s*\(\s*"([^"]+)"/i) || s.match(/HYPERLINK\s*\(\s*'([^']+)'/i);
        if (m) s = m[1];
    }
    if (s.startsWith('//')) s = 'https:' + s;
    return s;
}

async function urlToInlinePart(url) {
    const normalized = normalizePhotoUrl(url);
    if (!normalized || !/^https?:\/\//i.test(normalized)) return null;
    try {
        const res = await fetch(normalized, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const mime = blob.type || 'image/jpeg';
        return { inline_data: { mime_type: mime, data: b64 } };
    } catch {
        return null;
    }
}

function parseGeminiJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error('Resposta JSON inválida da IA');
    }
}

async function browserRunEvaluation(options, onProgress) {
    const s = afsLoadState();
    if (!s.api_key) throw new Error('Chave de API não configurada');
    if (!s.spreadsheet?.rows?.length) throw new Error('Nenhuma planilha carregada');

    const mappings = options.mappings || s.column_mappings || {};
    const rows = s.spreadsheet.rows;
    let totalTokens = 0;
    let evalIdCounter = (s.evaluations?.length || 0) + 1;
    window.__afs_eval_paused = false;

    const letter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };

    const link1Letter = letter('link1');
    const controlLetter = letter('control');
    const descLetter = letter('desc_original');
    const photoLetters = [letter('photo_original'), letter('photo_spec'), letter('photo_tag')];

    for (const row of rows) {
        if (window.__afs_eval_paused) break;

        const rowIdx = row._row_index;
        const controlVal = controlLetter ? row[controlLetter] : null;
        const descricao = descLetter ? row[descLetter] : 'Item sem descrição';
        const fotoUrl = normalizePhotoUrl(photoLetters[0] ? row[photoLetters[0]] : null) || 'Sem foto';
        const fotoSpec = normalizePhotoUrl(photoLetters[1] ? row[photoLetters[1]] : null) || 'Sem foto especificação';
        const fotoTag = normalizePhotoUrl(photoLetters[2] ? row[photoLetters[2]] : null) || 'Sem foto tag';
        const link1Val = link1Letter ? row[link1Letter] : null;

        const basePayload = {
            row: rowIdx,
            control: controlVal,
            description: descricao,
            photo_url: fotoUrl,
            photo_spec: fotoSpec,
            photo_tag: fotoTag,
            tokens: totalTokens
        };

        if (link1Val != null && String(link1Val).trim() !== '') {
            onProgress({ ...basePayload, status: 'Ignorado' });
            continue;
        }

        onProgress({ ...basePayload, status: 'Avaliando' });

        let visionData = {};
        let marketData = {};

        if (options.runTag || options.runAge || options.runConservation) {
            const imageUrls = [fotoUrl, fotoSpec, fotoTag].filter(u => u && /^https?:\/\//i.test(u));
            const parts = [{ text: AFS_VISION_PROMPT }];
            for (const url of imageUrls) {
                const part = await urlToInlinePart(url);
                if (part) parts.push(part);
            }
            if (parts.length > 1) {
                try {
                    const res = await afsGeminiRequest(s.api_key, options.model || 'gemini-2.5-flash', parts, true);
                    totalTokens += res.tokens || 0;
                    visionData = parseGeminiJson(res.text);
                } catch (e) {
                    console.warn('Vision error:', e);
                }
            }
        }

        if (options.runMarket || options.runCategoria || options.runAtivo) {
            const ctx = visionData.raciocinio_visual ? `\nContexto visual: ${visionData.raciocinio_visual}` : '';
            const prompt = `${AFS_VALUATION_PROMPT}\n\nBEM:\n${descricao}${ctx}`;
            try {
                const res = await afsGeminiRequest(s.api_key, options.model || 'gemini-2.5-flash', [{ text: prompt }], true);
                totalTokens += res.tokens || 0;
                marketData = parseGeminiJson(res.text);
            } catch (e) {
                onProgress({ ...basePayload, status: 'Erro API', tokens: totalTokens, error: e.message });
                break;
            }
        }

        const evaluation = {
            id: evalIdCounter++,
            asset_description: marketData.descricao_identificacao || descricao,
            asset_normalized: options.runAtivo ? (marketData.ativo || null) : null,
            category_normalized: options.runCategoria ? (marketData.categoria || null) : null,
            methodology: marketData.metodologia || 'Modo navegador',
            value_new: marketData.valor_novo ?? null,
            value_used: marketData.valor_usado ?? null,
            value_fipe: marketData.valor_fipe ?? null,
            apparent_age: visionData.idade_aparente_anos ?? null,
            conservation_state: visionData.estado_conservacao ?? null,
            links: (marketData.links_comparativos || []).join(','),
            reasoning: marketData.raciocinio_detalhado || visionData.raciocinio_visual || '',
            photo_url: fotoUrl,
            photo_spec: fotoSpec,
            photo_tag: fotoTag,
            created_at: new Date().toISOString()
        };

        s.evaluations = s.evaluations || [];
        s.evaluations.unshift(evaluation);

        if (options.runAtivo && letter('asset_output') && marketData.ativo) {
            row[letter('asset_output')] = marketData.ativo;
        }
        if (options.runCategoria && letter('category_output') && marketData.categoria) {
            row[letter('category_output')] = marketData.categoria;
        }

        afsSaveState(s);

        onProgress({
            ...basePayload,
            status: 'Concluído',
            tokens: totalTokens,
            eval_id: evaluation.id,
            ativo: marketData.ativo,
            categoria: marketData.categoria,
            apparent_age: visionData.idade_aparente_anos,
            conservation_state: visionData.estado_conservacao,
            tag_verificada: visionData.tag_encontrada,
            raciocinio_visual: visionData.raciocinio_visual,
            valuation: marketData
        });
    }

    onProgress({ status: 'finished' });
}

window.browserRunEvaluation = browserRunEvaluation;
window.normalizePhotoUrl = normalizePhotoUrl;
