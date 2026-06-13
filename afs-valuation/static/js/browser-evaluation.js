// ============================================================
// AFS — Avaliação client-side (GitHub Pages / modo navegador)
// ============================================================

const AFS_VISION_PROMPT = `Você é o núcleo visual de um sistema estilo Google Lens (Multimodal Transformer + busca visual CLIP/MUM).
Analise TODAS as imagens como um único objeto patrimonial. Cruze forma, cor, material, texto legível, plaqueta, tag e contexto.
Identifique o bem com precisão de busca visual: objeto principal, categoria de mercado, ativo padronizado, marca/modelo, similares.

IMPORTANTE: idade_aparente_anos e estado_conservacao devem ser estimados APENAS pela foto.
NÃO use dados de planilha, cadastro ou contexto externo — somente o que é visível nas imagens.

ESCALA estado_conservacao (inteiro 1-5):
5 = produto novo na caixa
4 = seminovo / open box / poucos meses de uso — SOMENTE se idade_aparente_anos é 0 ou 1
3 = conservação esperada para a idade do bem vs. pares (ex: torno 40 anos funcional e preservado = 3)
2 = abaixo do esperado para a idade OU avarias visíveis que exigem reparo
1 = sucata, totalmente quebrado ou abandonado

REGRA CRÍTICA: estado_conservacao 4 só é válido com idade_aparente_anos 0 ou 1.
Se idade_aparente_anos > 1, o máximo é 3 (mesmo se o bem parece muito preservado).

Retorne APENAS JSON válido:
{
  "ativo_identificado": "nome curto padronizado (ex: cadeira, impressora, veículo)",
  "categoria_identificada": "categoria ampla (mobiliário, informática, veículos...)",
  "marca_modelo": "marca e modelo se visíveis ou null",
  "descricao_visual": "descrição densa do que aparece (forma, material, cor, detalhes, textos lidos)",
  "objetos_similares": ["2-5 produtos/categorias visualmente similares no mercado brasileiro"],
  "confianca_identificacao": número de 0.0 a 1.0,
  "tag_encontrada": "número da tag/plaqueta lido na foto ou null",
  "idade_aparente_anos": inteiro estimado visualmente ou null,
  "estado_conservacao": inteiro 1-5 conforme escala acima ou null,
  "raciocinio_visual": "passo a passo do raciocínio multimodal por imagem"
}`;

const AFS_VALUATION_PROMPT = `Você é avaliador de ativos imobilizados no Brasil. Retorne APENAS JSON:
{
  "categoria": "categoria ampla (ex: mobiliário, TI, veículos)",
  "ativo": "nome curto padronizado em minúsculas (ex: cadeira, mesa)",
  "descricao_identificacao": "descrição melhorada",
  "metodologia": "metodologia usada",
  "tipo_anuncio_encontrado": "novo_e_usado | apenas_usado | apenas_novo | sem_anuncio",
  "valor_novo": number ou null,
  "valor_usado": number ou null,
  "valor_fipe": number ou null,
  "links_comparativos": ["urls"],
  "raciocinio_detalhado": "passo a passo"
}

REGRAS DE PREÇO:
- Se encontrou anúncio de item NOVO e usado: preencha valor_novo e valor_usado.
- Se encontrou APENAS item usado (ex: trator 2023 usado): valor_novo=null, valor_usado=preço do usado, tipo_anuncio_encontrado=apenas_usado.
- Se só encontrou novo: valor_usado pode ser estimado por depreciação ou null.

REGRAS DE LINKS (CRÍTICO):
- links_comparativos: SOMENTE URLs http/https REAIS que um humano pode abrir hoje.
- Use sites brasileiros conhecidos: mercadolivre.com.br, olx.com.br, shopee.com.br, amazon.com.br, webmotors.com.br, mgl.com.br, etc.
- NÃO invente URLs, IDs fictícios ou domínios genéricos (example.com).
- Se não tem link direto confiável, use URL de busca do site com query relevante (ex: https://www.mercadolivre.com.br/busca?q=...)
- Prefira 1-3 links úteis, não liste links quebrados.`;

async function urlToInlinePart(url) {
    const normalized = (typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(url) : url);
    if (!normalized || !/^https?:\/\//i.test(normalized)) return null;

    const inferMime = (u) => {
        if (/\.png(\?|$)/i.test(u)) return 'image/png';
        if (/\.webp(\?|$)/i.test(u)) return 'image/webp';
        if (/\.gif(\?|$)/i.test(u)) return 'image/gif';
        return 'image/jpeg';
    };

    const blobToInline = async (blob, mimeHint) => {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const mime = blob.type || mimeHint || 'image/jpeg';
        return { inline_data: { mime_type: mime, data: btoa(binary) } };
    };

    try {
        const res = await fetch(normalized, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' });
        if (res.ok) return await blobToInline(await res.blob(), inferMime(normalized));
    } catch {
        /* CORS — tentar canvas ou file_uri */
    }

    const canvasPart = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                const b64 = dataUrl.split(',')[1];
                resolve(b64 ? { inline_data: { mime_type: 'image/jpeg', data: b64 } } : null);
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = normalized;
    });
    if (canvasPart) return canvasPart;

    return { file_data: { mime_type: inferMime(normalized), file_uri: normalized } };
}

function afsNormalizeVisionNumbers(visionData) {
    if (!visionData || typeof visionData !== 'object') return {};
    const v = { ...visionData };
    if (v.estado_conservacao != null && v.estado_conservacao !== '') {
        const n = parseInt(v.estado_conservacao, 10);
        v.estado_conservacao = Number.isNaN(n) ? v.estado_conservacao : n;
    }
    if (v.idade_aparente_anos != null && v.idade_aparente_anos !== '') {
        const n = parseInt(v.idade_aparente_anos, 10);
        v.idade_aparente_anos = Number.isNaN(n) ? v.idade_aparente_anos : n;
    }
    if (v.tag_encontrada != null) v.tag_encontrada = String(v.tag_encontrada).trim();
    return v;
}

function afsAlignConservationWithAge(age, conservation) {
    if (conservation == null || conservation === '') return conservation;
    const c = parseInt(conservation, 10);
    if (Number.isNaN(c)) return conservation;
    if (c !== 4) return c;
    const a = parseInt(age, 10);
    if (Number.isNaN(a) || a > 1) return 3;
    return c;
}

const AFS_TAG_UNREADABLE = 'não foi possível verificar';

function afsResolveTagOutput(tagEncontrada, visionAttempted) {
    if (tagEncontrada != null && String(tagEncontrada).trim() !== '') {
        return String(tagEncontrada).trim();
    }
    if (visionAttempted) return AFS_TAG_UNREADABLE;
    return null;
}

function afsCorrectTagColumnMappings(mappings, headers) {
    if (!mappings || !headers?.length) return mappings;
    const out = { ...mappings };
    const hasLetter = (l) => headers.some(h => h.letter === l);
    const tagOut = out.tag_output;
    const tagOrig = out.tag_original;

    if (hasLetter('D') && !out.tag_original) out.tag_original = 'D';
    if (hasLetter('C') && !out.tag_output) out.tag_output = 'C';

    if (hasLetter('C') && tagOut === 'D') out.tag_output = 'C';
    if (hasLetter('D') && !out.tag_original) out.tag_original = 'D';
    if (tagOut && tagOrig && tagOut === tagOrig && hasLetter('C') && hasLetter('D')) {
        out.tag_output = 'C';
        out.tag_original = 'D';
    }
    return out;
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

function afsPhotosForStorage(photos) {
    return (photos || [])
        .filter(p => p?.url && /^https?:\/\//i.test(String(p.url)))
        .map(p => ({
            url: p.url,
            type: p.type || 'Foto',
            category: p.category || p.type || 'Foto',
            key: p.key || null
        }));
}

function afsPhotoUrlsFromList(photos) {
    const list = photos || [];
    const find = (re) => list.find(p => re.test(String(p.category || p.type || '')));
    return {
        fotoUrl: find(/bem/i)?.url || list[0]?.url || null,
        fotoSpec: find(/espec/i)?.url || null,
        fotoTag: find(/tag/i)?.url || null
    };
}

function afsNormalizeDescForMatch(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function afsDescSimilarity(a, b) {
    const na = afsNormalizeDescForMatch(a);
    const nb = afsNormalizeDescForMatch(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const wordsA = na.split(' ').filter(w => w.length > 2);
    const wordsB = nb.split(' ').filter(w => w.length > 2);
    if (!wordsA.length || !wordsB.length) return 0;
    const common = wordsA.filter(w => wordsB.includes(w));
    return common.length / Math.max(wordsA.length, wordsB.length);
}

function afsFindReusableEvaluation(row, descricao, s, spreadsheet, mappings) {
    const descLetter = typeof mappings.desc_original === 'string' ? mappings.desc_original : mappings.desc_original?.letter;
    const assetLetter = typeof mappings.asset_output === 'string' ? mappings.asset_output : mappings.asset_output?.letter;
    const threshold = 0.72;

    for (const ev of s.evaluations || []) {
        if (ev.row_index === row._row_index) continue;

        let score = afsDescSimilarity(ev.asset_description, descricao);

        const otherRow = spreadsheet.rows?.find(r => r._row_index === ev.row_index);
        if (otherRow && descLetter) {
            score = Math.max(score, afsDescSimilarity(otherRow[descLetter], descricao));
        }

        if (ev.asset_normalized) {
            score = Math.max(score, afsDescSimilarity(ev.asset_normalized, descricao));
            if (assetLetter && row[assetLetter]) {
                if (String(ev.asset_normalized).toLowerCase() === String(row[assetLetter]).toLowerCase()) {
                    score = Math.max(score, 0.92);
                }
            }
        }

        if (score >= threshold) return ev;
    }
    return null;
}

function afsCloneEvaluationForRow(sourceEv, rowIdx, controlVal, photos, newId, descricao) {
    const urls = afsPhotoUrlsFromList(photos);
    const storedPhotos = afsPhotosForStorage(photos);
    return {
        id: newId,
        row_index: rowIdx,
        control: controlVal,
        asset_description: sourceEv.asset_description || descricao,
        asset_normalized: sourceEv.asset_normalized,
        category_normalized: sourceEv.category_normalized,
        methodology: sourceEv.methodology ? `${sourceEv.methodology} (reutilizado)` : 'Reutilizado de item similar',
        value_new: sourceEv.value_new,
        value_used: sourceEv.value_used,
        value_fipe: sourceEv.value_fipe,
        apparent_age: sourceEv.apparent_age,
        conservation_state: sourceEv.conservation_state,
        tag_verified: sourceEv.tag_verified,
        links: sourceEv.links,
        links_array: sourceEv.links_array || (sourceEv.links ? String(sourceEv.links).split(',').map(x => x.trim()).filter(Boolean) : []),
        reasoning: sourceEv.reasoning
            ? `[Reutilizado do controle ${sourceEv.control ?? sourceEv.row_index}]\n${sourceEv.reasoning}`
            : `[Reutilizado do controle ${sourceEv.control ?? sourceEv.row_index}]`,
        photo_url: urls.fotoUrl || 'Sem foto',
        photo_spec: urls.fotoSpec || 'Sem foto especificação',
        photo_tag: urls.fotoTag || 'Sem foto tag',
        photos: storedPhotos.length ? storedPhotos : (sourceEv.photos || []),
        reused_from: sourceEv.id,
        marca_modelo: sourceEv.marca_modelo,
        confianca_identificacao: sourceEv.confianca_identificacao,
        created_at: new Date().toISOString()
    };
}

function afsSanitizeComparativeLinks(raw) {
    const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split(',') : []);
    const out = [];
    const badPattern = /example\.com|localhost|placeholder|ficticio|fake|test\.com/i;
    for (let u of list) {
        let s = String(u || '').trim();
        if (!s) continue;
        const md = s.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
        if (md) s = md[1];
        if (!/^https?:\/\//i.test(s)) continue;
        if (badPattern.test(s)) continue;
        try {
            const parsed = new URL(s);
            if (!parsed.hostname.includes('.')) continue;
        } catch {
            continue;
        }
        if (!out.includes(s)) out.push(s);
    }
    return out;
}

function afsNormalizeMarketPrices(marketData) {
    if (!marketData) return marketData;
    const tipo = String(marketData.tipo_anuncio_encontrado || '').toLowerCase().replace(/\s+/g, '_');
    if (tipo.includes('apenas_usado') || tipo === 'usado') {
        marketData.valor_novo = null;
    }
    return marketData;
}

function afsCollectImageUrls(row, mappings, spreadsheet) {
    const resolved = typeof afsResolveRowPhotos === 'function' && spreadsheet
        ? afsResolveRowPhotos(row, spreadsheet.headers, spreadsheet.photo_lookup || {}, mappings)
        : row;
    const urls = [];

    if (typeof afsCollectPhotosForRow === 'function' && spreadsheet) {
        const photos = afsCollectPhotosForRow(
            resolved,
            mappings,
            afsGetPhotoLookups(spreadsheet),
            spreadsheet.headers
        );
        photos.forEach(p => {
            const u = typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(p.url) : p.url;
            if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
        });
    }

    const mapLetter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };
    for (const field of ['photo_original', 'photo_spec', 'photo_tag']) {
        const letter = mapLetter(field);
        if (!letter) continue;
        const u = typeof normalizePhotoUrl === 'function' ? normalizePhotoUrl(resolved[letter]) : resolved[letter];
        if (u && /^https?:\/\//i.test(u) && !urls.includes(u)) urls.push(u);
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

async function afsEvaluateSingleRow(row, options, spreadsheet, mappings, feedbackCtx = '', onStep = null) {
    const emit = (stepLabel, itemPercent) => {
        if (onStep) onStep({ stepLabel, itemPercent });
    };

    const s = afsLoadState();
    mappings = afsCorrectTagColumnMappings(mappings, spreadsheet.headers);
    const letter = (field) => {
        const m = mappings[field];
        return typeof m === 'string' ? m : m?.letter || '';
    };

    const rowIdx = row._row_index;
    const controlLetter = letter('control');
    const descLetter = letter('desc_original');
    const controlVal = controlLetter ? row[controlLetter] : null;
    const descricao = descLetter ? row[descLetter] : 'Item sem descrição';

    emit('Preparando item e coletando fotos...', 8);

    const resolvedRow = typeof afsResolveRowPhotos === 'function'
        ? afsResolveRowPhotos(row, spreadsheet.headers, spreadsheet.photo_lookup || {}, mappings)
        : row;

    const photos = typeof afsCollectPhotosForRow === 'function'
        ? afsCollectPhotosForRow(resolvedRow, mappings, afsGetPhotoLookups(spreadsheet), spreadsheet.headers)
        : [];
    const { fotoUrl, fotoSpec, fotoTag } = afsPhotoUrlsFromList(photos);
    const photosStored = afsPhotosForStorage(photos);

    let totalTokens = 0;
    let visionData = {};
    let marketData = {};

    const imageUrls = afsCollectImageUrls(resolvedRow, mappings, spreadsheet);
    let visionImagesSent = 0;

    if (options.runTag || options.runAge || options.runConservation || imageUrls.length) {
        emit(`Análise visual (Vision): ${imageUrls.length} foto(s) — identificando bem...`, 18);
        const parts = [{ text: AFS_VISION_PROMPT }];
        let loadedParts = 0;
        for (const url of imageUrls) {
            const part = await urlToInlinePart(url);
            if (part) {
                parts.push(part);
                loadedParts++;
            }
        }
        visionImagesSent = loadedParts;
        if (loadedParts > 0) {
            emit(`Enviando ${loadedParts} imagem(ns) ao Gemini Vision...`, 32);
            try {
                const res = await afsGeminiRequest(s.api_key, options.model || 'gemini-2.5-flash', parts, true);
                totalTokens += res.tokens || 0;
                visionData = afsNormalizeVisionNumbers(parseGeminiJson(res.text));
                emit('Vision concluída — processando identificação visual...', 48);
            } catch (e) {
                console.warn('Vision error:', e);
                emit(`Aviso: falha na análise visual (${e.message || 'erro'}) — continuando...`, 48);
            }
        } else {
            emit('Sem imagens legíveis para Vision (CORS/URL) — TAG/idade/conservação não calculadas...', 48);
        }
    }

    if (options.runMarket || options.runCategoria || options.runAtivo) {
        emit('Avaliação de mercado: buscando comparáveis e valores...', 58);
        let rulesCtx = '';
        const rulesText = s.learning_rules_text || (typeof AFS_DEFAULT_LEARNING_RULES !== 'undefined' ? AFS_DEFAULT_LEARNING_RULES : '');
        if (typeof afsRulesToPromptText === 'function') rulesCtx = afsRulesToPromptText(rulesText);
        (s.auto_aprendizados || []).slice(-5).forEach(a => {
            rulesCtx += `\n- Aprendizado recente: ${a.feedback_usuario || ''} (valor: ${a.valor_correto ?? '-'})`;
        });
        const ctx = buildVisionContext(visionData) + rulesCtx + (feedbackCtx || '');
        const prompt = `${AFS_VALUATION_PROMPT}\n\nBEM:\n${descricao}${ctx}`;
        emit('Consultando Gemini para precificação e raciocínio...', 72);
        const res = await afsGeminiRequest(s.api_key, options.model || 'gemini-2.5-flash', [{ text: prompt }], true);
        totalTokens += res.tokens || 0;
        marketData = parseGeminiJson(res.text);
        marketData = afsNormalizeMarketPrices(marketData);
        emit('Mercado concluído — consolidando valores e metodologia...', 88);
    }

    emit('Finalizando avaliação do item...', 96);

    const linksArr = afsSanitizeComparativeLinks(marketData.links_comparativos);
    marketData.links_comparativos = linksArr;

    const tagOut = options.runTag
        ? afsResolveTagOutput(visionData.tag_encontrada, visionImagesSent > 0)
        : null;
    const ageOut = options.runAge ? (visionData.idade_aparente_anos ?? null) : null;
    let consOut = options.runConservation ? (visionData.estado_conservacao ?? null) : null;
    if (consOut != null && ageOut != null) {
        consOut = afsAlignConservationWithAge(ageOut, consOut);
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
        apparent_age: ageOut,
        conservation_state: consOut,
        tag_verified: tagOut,
        links: linksArr.join(','),
        links_array: linksArr,
        reasoning: marketData.raciocinio_detalhado || visionData.raciocinio_visual || '',
        photo_url: fotoUrl || 'Sem foto',
        photo_spec: fotoSpec || 'Sem foto especificação',
        photo_tag: fotoTag || 'Sem foto tag',
        photos: photosStored,
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
        tokens: totalTokens,
        photos: photosStored
    };
}

async function browserRunEvaluation(options, onProgress) {
    const s = afsLoadState();
    if (!s.api_key) throw new Error('Chave de API não configurada');
    if (!s.spreadsheet?.rows?.length) throw new Error('Nenhuma planilha carregada');

    const spreadsheet = s.spreadsheet;
    const mappings = afsCorrectTagColumnMappings(
        options.mappings || afsGetActiveMappings(s),
        spreadsheet.headers
    );
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

    const pendingRows = rows.filter(r =>
        typeof afsIsRowPendingEvaluation === 'function'
            ? afsIsRowPendingEvaluation(r, s, mappings)
            : true
    );
    const totalPending = pendingRows.length;
    let completedCount = 0;

    if (totalPending === 0) {
        onProgress({
            status: 'finished',
            stepLabel: 'Nenhum item pendente para avaliar.',
            overallPercent: 100,
            message: 'Todos os itens já foram avaliados ou ignorados.'
        });
        return;
    }

    onProgress({
        status: 'started',
        stepLabel: `${totalPending} item(ns) pendente(s) — iniciando...`,
        overallPercent: 0,
        totalPending
    });

    for (const row of rows) {
        if (window.__afs_eval_paused) break;

        const rowIdx = row._row_index;
        const controlLetter = letter('control');
        const controlVal = controlLetter ? row[controlLetter] : null;
        const descLetter = letter('desc_original');
        const descricao = descLetter ? row[descLetter] : 'Item sem descrição';
        const link1Val = link1Letter ? row[link1Letter] : null;

        const photos = typeof afsCollectPhotosForRow === 'function'
            ? afsCollectPhotosForRow(row, mappings, afsGetPhotoLookups(spreadsheet), spreadsheet.headers)
            : [];
        const photoUrls = afsPhotoUrlsFromList(photos);
        const fotoUrl = photoUrls.fotoUrl || 'Sem foto';
        const fotoSpec = photoUrls.fotoSpec || 'Sem foto especificação';
        const fotoTag = photoUrls.fotoTag || 'Sem foto tag';
        const photosStored = afsPhotosForStorage(photos);

        const basePayload = {
            row: rowIdx,
            control: controlVal,
            description: descricao,
            photo_url: fotoUrl,
            photo_spec: fotoSpec,
            photo_tag: fotoTag,
            photos: photosStored,
            tokens: totalTokens
        };

        const isPending = typeof afsIsRowPendingEvaluation === 'function'
            ? afsIsRowPendingEvaluation(row, s, mappings)
            : (link1Val == null || String(link1Val).trim() === '');

        if (!isPending) {
            onProgress({ ...basePayload, status: 'Ignorado' });
            continue;
        }

        const itemNum = completedCount + 1;

        const similarEv = afsFindReusableEvaluation(row, descricao, s, spreadsheet, mappings);
        if (similarEv) {
            onProgress({
                ...basePayload,
                status: 'Avaliando',
                stepLabel: `Item ${itemNum}/${totalPending}: reutilizando avaliação similar (controle ${similarEv.control ?? similarEv.row_index})...`,
                overallPercent: Math.round((completedCount / totalPending) * 100),
                itemPercent: 40
            });

            const evaluation = afsCloneEvaluationForRow(similarEv, rowIdx, controlVal, photos, evalIdCounter++, descricao);
            s.evaluations = s.evaluations || [];
            s.evaluations.unshift(evaluation);

            if (typeof afsMarkRowEvaluated === 'function') afsMarkRowEvaluated(s, rowIdx);
            if (typeof afsApplyEvaluationToRow === 'function') afsApplyEvaluationToRow(row, evaluation, mappings, spreadsheet.headers);
            if (options.runAtivo && letter('asset_output') && evaluation.asset_normalized) {
                row[letter('asset_output')] = evaluation.asset_normalized;
            }
            if (options.runCategoria && letter('category_output') && evaluation.category_normalized) {
                row[letter('category_output')] = evaluation.category_normalized;
            }
            afsSaveState(s);
            completedCount++;

            onProgress({
                ...basePayload,
                status: 'Concluído (reutilizado)',
                tokens: totalTokens,
                eval_id: evaluation.id,
                photos: evaluation.photos,
                ativo: evaluation.asset_normalized,
                categoria: evaluation.category_normalized,
                apparent_age: evaluation.apparent_age,
                conservation_state: evaluation.conservation_state,
                tag_verificada: evaluation.tag_verified,
                valuation: { ativo: evaluation.asset_normalized, categoria: evaluation.category_normalized },
                stepLabel: `Item ${itemNum}/${totalPending}: concluído (reutilizado) ✓`,
                overallPercent: Math.round((completedCount / totalPending) * 100),
                itemPercent: 100
            });
            continue;
        }

        onProgress({
            ...basePayload,
            status: 'Avaliando',
            stepLabel: `Item ${itemNum}/${totalPending}: preparando avaliação...`,
            overallPercent: Math.round((completedCount / totalPending) * 100),
            itemPercent: 0
        });

        try {
            const result = await afsEvaluateSingleRow(row, options, spreadsheet, mappings, '', (step) => {
                onProgress({
                    ...basePayload,
                    status: 'Avaliando',
                    stepLabel: `Item ${itemNum}/${totalPending}: ${step.stepLabel}`,
                    overallPercent: Math.round((completedCount / totalPending) * 100 + (step.itemPercent || 0) / totalPending),
                    itemPercent: step.itemPercent || 0
                });
            });
            totalTokens += result.tokens;

            const evaluation = { id: evalIdCounter++, ...result.evaluation };
            s.evaluations = s.evaluations || [];
            s.evaluations.unshift(evaluation);

            if (typeof afsMarkRowEvaluated === 'function') {
                afsMarkRowEvaluated(s, rowIdx);
            }
            if (typeof afsApplyEvaluationToRow === 'function') {
                afsApplyEvaluationToRow(row, evaluation, mappings, spreadsheet.headers);
            }

            if (options.runAtivo && letter('asset_output') && result.evaluation.asset_normalized) {
                row[letter('asset_output')] = result.evaluation.asset_normalized;
            }
            if (options.runCategoria && letter('category_output') && result.evaluation.category_normalized) {
                row[letter('category_output')] = result.evaluation.category_normalized;
            }

            afsSaveState(s);
            completedCount++;

            onProgress({
                ...basePayload,
                status: 'Concluído',
                tokens: totalTokens,
                eval_id: evaluation.id,
                photos: evaluation.photos || result.photos,
                ativo: result.evaluation.asset_normalized,
                categoria: result.evaluation.category_normalized,
                apparent_age: result.evaluation.apparent_age,
                conservation_state: result.evaluation.conservation_state,
                tag_verificada: result.evaluation.tag_verified,
                links: result.evaluation.links,
                links_array: result.evaluation.links_array,
                raciocinio_visual: result.visionData.raciocinio_visual,
                valuation: { ...result.marketData, links_comparativos: result.evaluation.links_array },
                stepLabel: `Item ${itemNum}/${totalPending}: avaliação concluída ✓`,
                overallPercent: Math.round((completedCount / totalPending) * 100),
                itemPercent: 100
            });
        } catch (e) {
            onProgress({
                ...basePayload,
                status: 'Erro API',
                tokens: totalTokens,
                error: e.message,
                stepLabel: `Erro no item ${itemNum}/${totalPending}: ${e.message}`,
                overallPercent: Math.round((completedCount / totalPending) * 100)
            });
            break;
        }
    }

    onProgress({ status: 'finished', overallPercent: 100, stepLabel: 'Avaliação finalizada.' });
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
    if (typeof afsMarkRowEvaluated === 'function') afsMarkRowEvaluated(s, rowIdx);
    if (typeof afsApplyEvaluationToRow === 'function') afsApplyEvaluationToRow(row, updated, mappings, spreadsheet.headers);

    const link1Letter = mappings.link1;
    if (link1Letter) row[link1Letter] = '';

    afsSaveState(s);
    return { status: 'ok', evaluation: s.evaluations[evIdx] || updated, tokens: result.tokens };
}

window.browserRunEvaluation = browserRunEvaluation;
window.browserReEvaluateRow = browserReEvaluateRow;
window.afsCorrectTagColumnMappings = afsCorrectTagColumnMappings;
window.afsAlignConservationWithAge = afsAlignConservationWithAge;
