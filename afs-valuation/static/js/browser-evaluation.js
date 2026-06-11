// ============================================================
// AFS — Avaliação client-side (GitHub Pages / modo navegador)
// ============================================================

const AFS_VISION_PROMPT = `Você é o núcleo visual de um sistema estilo Google Lens (Multimodal Transformer + busca visual CLIP/MUM).
Analise TODAS as imagens como um único objeto patrimonial. Cruze forma, cor, material, texto legível, plaqueta, tag e contexto.
Identifique o bem com precisão de busca visual: objeto principal, categoria de mercado, ativo padronizado, marca/modelo, similares.
Retorne APENAS JSON válido:
{
  "ativo_identificado": "nome curto padronizado (ex: cadeira, impressora, veículo)",
  "categoria_identificada": "categoria ampla (mobiliário, informática, veículos...)",
  "marca_modelo": "marca e modelo se visíveis ou null",
  "descricao_visual": "descrição densa do que aparece (forma, material, cor, detalhes, textos lidos)",
  "objetos_similares": ["2-5 produtos/categorias visualmente similares no mercado brasileiro"],
  "confianca_identificacao": número de 0.0 a 1.0,
  "tag_encontrada": "número da tag/plaqueta lido ou null",
  "idade_aparente_anos": inteiro ou null,
  "estado_conservacao": inteiro 1-5 ou null,
  "raciocinio_visual": "passo a passo do raciocínio multimodal por imagem"
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

async function urlToInlinePart(url) {
    const normalized = (typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(url) : url);
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

function afsCollectImageUrls(row, mappings, spreadsheet) {
    const resolved = typeof afsResolveRowPhotos === 'function' && spreadsheet
        ? afsResolveRowPhotos(row, spreadsheet.headers, spreadsheet.photo_lookup || {}, mappings)
        : row;
    const letters = [
        mappings.photo_original,
        mappings.photo_spec,
        mappings.photo_tag
    ].filter(Boolean);
    const urls = [];
    for (const letter of letters) {
        const u = normalizePhotoUrl(resolved[letter]);
        if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
    }
    if (urls.length === 0 && typeof afsCollectPhotosForRow === 'function' && spreadsheet) {
        const photos = afsCollectPhotosForRow(resolved, mappings, spreadsheet.photo_lookup || {}, spreadsheet.headers);
        photos.forEach(p => { if (p.url && !urls.includes(p.url)) urls.push(p.url); });
    }
    return urls;
}

function buildVisionContext(visionData) {
    if (!visionData || !Object.keys(visionData).length) return '';
    const parts = [];
    if (visionData.ativo_identificado) parts.push(`Ativo identificado visualmente: ${visionData.ativo_identificado}`);
    if (visionData.categoria_identificada) parts.push(`Categoria visual: ${visionData.categoria_identificada}`);
    if (visionData.marca_modelo) parts.push(`Marca/Modelo: ${visionData.marca_modelo}`);
    if (visionData.descricao_visual) parts.push(`Descrição visual: ${visionData.descricao_visual}`);
    if (visionData.objetos_similares?.length) parts.push(`Objetos similares: ${visionData.objetos_similares.join(', ')}`);
    if (visionData.confianca_identificacao != null) parts.push(`Confiança identificação: ${visionData.confianca_identificacao}`);
    if (visionData.raciocinio_visual) parts.push(`Raciocínio visual: ${visionData.raciocinio_visual}`);
    return parts.length ? '\n\nCONTEXTO DE IDENTIFICAÇÃO VISUAL (Google Lens):\n' + parts.join('\n') : '';
}

async function afsEvaluateSingleRow(row, options, spreadsheet, mappings, feedbackCtx = '') {
    const s = afsLoadState();
    const letter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };

    const rowIdx = row._row_index;
    const controlLetter = letter('control');
    const descLetter = letter('desc_original');
    const controlVal = controlLetter ? row[controlLetter] : null;
    const descricao = descLetter ? row[descLetter] : 'Item sem descrição';

    const resolvedRow = typeof afsResolveRowPhotos === 'function'
        ? afsResolveRowPhotos(row, spreadsheet.headers, spreadsheet.photo_lookup || {}, mappings)
        : row;

    const photos = typeof afsCollectPhotosForRow === 'function'
        ? afsCollectPhotosForRow(resolvedRow, mappings, spreadsheet.photo_lookup || {}, spreadsheet.headers)
        : [];
    const fotoUrl = photos[0]?.url || normalizePhotoUrl(letter('photo_original') ? resolvedRow[letter('photo_original')] : null) || 'Sem foto';
    const fotoSpec = photos[1]?.url || normalizePhotoUrl(letter('photo_spec') ? resolvedRow[letter('photo_spec')] : null) || 'Sem foto especificação';
    const fotoTag = photos[2]?.url || normalizePhotoUrl(letter('photo_tag') ? resolvedRow[letter('photo_tag')] : null) || 'Sem foto tag';

    let totalTokens = 0;
    let visionData = {};
    let marketData = {};

    const imageUrls = afsCollectImageUrls(resolvedRow, mappings, spreadsheet);

    if (options.runTag || options.runAge || options.runConservation || imageUrls.length) {
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
        const ctx = buildVisionContext(visionData) + (feedbackCtx || '');
        const prompt = `${AFS_VALUATION_PROMPT}\n\nBEM:\n${descricao}${ctx}`;
        const res = await afsGeminiRequest(s.api_key, options.model || 'gemini-2.5-flash', [{ text: prompt }], true);
        totalTokens += res.tokens || 0;
        marketData = parseGeminiJson(res.text);
    }

    const evaluation = {
        row_index: rowIdx,
        control: controlVal,
        asset_description: marketData.descricao_identificacao || descricao,
        asset_normalized: options.runAtivo !== false
            ? (marketData.ativo || visionData.ativo_identificado || null)
            : null,
        category_normalized: options.runCategoria !== false
            ? (marketData.categoria || visionData.categoria_identificada || null)
            : null,
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
        marca_modelo: visionData.marca_modelo || null,
        confianca_identificacao: visionData.confianca_identificacao ?? null,
        created_at: new Date().toISOString()
    };

    return {
        rowIdx,
        controlVal,
        descricao,
        fotoUrl,
        fotoSpec,
        fotoTag,
        visionData,
        marketData,
        evaluation,
        tokens: totalTokens
    };
}

async function browserRunEvaluation(options, onProgress) {
    const s = afsLoadState();
    if (!s.api_key) throw new Error('Chave de API não configurada');
    if (!s.spreadsheet?.rows?.length) throw new Error('Nenhuma planilha carregada');

    const mappings = options.mappings || s.column_mappings || {};
    const spreadsheet = s.spreadsheet;
    const rows = typeof afsResolveAllRowsPhotos === 'function'
        ? afsResolveAllRowsPhotos(spreadsheet, mappings)
        : spreadsheet.rows;
    let totalTokens = 0;
    let evalIdCounter = (s.evaluations?.length || 0) + 1;
    window.__afs_eval_paused = false;

    const letter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };
    const link1Letter = letter('link1');

    for (const row of rows) {
        if (window.__afs_eval_paused) break;

        const rowIdx = row._row_index;
        const controlLetter = letter('control');
        const controlVal = controlLetter ? row[controlLetter] : null;
        const descLetter = letter('desc_original');
        const descricao = descLetter ? row[descLetter] : 'Item sem descrição';
        const link1Val = link1Letter ? row[link1Letter] : null;

        const photos = typeof afsCollectPhotosForRow === 'function'
            ? afsCollectPhotosForRow(row, mappings, spreadsheet.photo_lookup || {}, spreadsheet.headers)
            : [];
        const fotoUrl = photos[0]?.url || 'Sem foto';
        const fotoSpec = photos[1]?.url || 'Sem foto especificação';
        const fotoTag = photos[2]?.url || 'Sem foto tag';

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

        try {
            const result = await afsEvaluateSingleRow(row, options, spreadsheet, mappings);
            totalTokens += result.tokens;

            const evaluation = { id: evalIdCounter++, ...result.evaluation };
            s.evaluations = s.evaluations || [];
            s.evaluations.unshift(evaluation);

            if (options.runAtivo && letter('asset_output') && result.evaluation.asset_normalized) {
                row[letter('asset_output')] = result.evaluation.asset_normalized;
            }
            if (options.runCategoria && letter('category_output') && result.evaluation.category_normalized) {
                row[letter('category_output')] = result.evaluation.category_normalized;
            }

            afsSaveState(s);

            onProgress({
                ...basePayload,
                status: 'Concluído',
                tokens: totalTokens,
                eval_id: evaluation.id,
                ativo: result.evaluation.asset_normalized,
                categoria: result.evaluation.category_normalized,
                apparent_age: result.evaluation.apparent_age,
                conservation_state: result.evaluation.conservation_state,
                tag_verificada: result.visionData.tag_encontrada,
                raciocinio_visual: result.visionData.raciocinio_visual,
                valuation: result.marketData
            });
        } catch (e) {
            onProgress({ ...basePayload, status: 'Erro API', tokens: totalTokens, error: e.message });
            break;
        }
    }

    onProgress({ status: 'finished' });
}

async function browserReEvaluateRow({ rowIdx, evaluationId, userComment, correctedValue, model }) {
    const s = afsLoadState();
    if (!s.api_key) throw new Error('Chave de API não configurada');
    const mappings = afsGetActiveMappings(s);
    const spreadsheet = s.spreadsheet;
    const rows = typeof afsResolveAllRowsPhotos === 'function'
        ? afsResolveAllRowsPhotos(spreadsheet, mappings)
        : spreadsheet.rows;
    const row = rows.find(r => r._row_index === rowIdx);
    if (!row) throw new Error('Linha da planilha não encontrada');

    let feedbackCtx = '';
    if (userComment) feedbackCtx += `\n\nFEEDBACK DO USUÁRIO (incorpore na avaliação): ${userComment}`;
    if (correctedValue != null && !Number.isNaN(Number(correctedValue))) {
        feedbackCtx += `\nValor de mercado corrigido informado pelo usuário: R$ ${correctedValue}`;
    }
    (s.auto_aprendizados || []).slice(-5).forEach(a => {
        feedbackCtx += `\n- Aprendizado: ${a.feedback_usuario} (valor: ${a.valor_correto})`;
    });

    const options = {
        model: model || 'gemini-2.5-flash',
        runTag: true,
        runAge: true,
        runConservation: true,
        runMarket: true,
        runCategoria: true,
        runAtivo: true
    };

    const result = await afsEvaluateSingleRow(row, options, spreadsheet, mappings, feedbackCtx);
    const evIdx = (s.evaluations || []).findIndex(e => e.id === evaluationId);
    const updated = { id: evaluationId, ...result.evaluation };
    if (correctedValue != null && !Number.isNaN(Number(correctedValue)) && updated.value_used == null) {
        updated.value_used = Number(correctedValue);
    }

    if (evIdx >= 0) {
        s.evaluations[evIdx] = { ...s.evaluations[evIdx], ...updated };
    }

    const link1Letter = mappings.link1;
    if (link1Letter) row[link1Letter] = '';

    afsSaveState(s);
    return { status: 'ok', evaluation: updated, tokens: result.tokens };
}

window.browserRunEvaluation = browserRunEvaluation;
window.browserReEvaluateRow = browserReEvaluateRow;
