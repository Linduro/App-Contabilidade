// ============================================================
// AFS — Fotos Coletum (especificação exata)
// Col A (texto) + ".0"/".1"/… por QUANTIDADE nas colunas Foto do Bem / Espec / TAG
// 3 abas: "Foto do Bem", "Foto Especificações", "Foto da TAG"
// Em cada aba: chave col B, URL col D (com auto-detecção + hyperlinks)
// ============================================================

function normalizePhotoUrl(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') {
        if (raw.Target) return normalizePhotoUrl(raw.Target);
        if (raw.l) return normalizePhotoUrl(raw.l);
        if (raw.text) return normalizePhotoUrl(raw.text);
        if (raw.hyperlink) return normalizePhotoUrl(raw.hyperlink);
    }
    let s = String(raw).trim().replace(/;+$/, '');
    if (!s) return null;
    if (s.startsWith('=') && /HYPERLINK/i.test(s)) {
        const m = s.match(/HYPERLINK\s*\(\s*"([^"]+)"/i) || s.match(/HYPERLINK\s*\(\s*'([^']+)'/i);
        if (m) s = m[1].replace(/;+$/, '');
    }
    if (s.startsWith('//')) s = 'https:' + s;
    return s;
}

/** Preserva código patrimonial como texto (ex: 31807.158 ou 31807.158.0) */
function afsFormatPhotoKey(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return String(val);
        const s = val.toFixed(6).replace(/\.?0+$/, '');
        return s.includes('.') ? s : String(val);
    }
    return String(val).trim().replace(/;+$/, '');
}

function afsIsPhotoKeyShape(key) {
    if (!key) return false;
    return /^\d+\.\d+(\.\d+)?$/.test(key) || /^\d+\.\d+\.\d+$/.test(key);
}

function afsRegisterPhotoKey(lookup, key, url) {
    const k = afsFormatPhotoKey(key);
    const u = normalizePhotoUrl(url);
    if (!k || !u || !/^https?:\/\//i.test(u)) return;
    lookup[k] = u;
    const parts = k.match(/^(.+)\.(\d+)$/);
    if (parts) {
        const base = parts[1];
        const idx = parts[2];
        lookup[`${base}.${idx}`] = u;
        if (idx === '0') lookup[base] = u;
    } else if (/^\d+\.\d+$/.test(k)) {
        lookup[`${k}.0`] = u;
    }
}

function afsGetSheetCell(ws, r, c, rowsFormatted, rowsRaw) {
    if (ws && c >= 0) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
            if (cell.l) {
                const link = normalizePhotoUrl(cell.l.Target || cell.l);
                if (link && /^https?:\/\//i.test(link)) return link;
            }
            if (cell.v != null && cell.v !== '') return cell.v;
            if (cell.w) return cell.w;
        }
    }
    const raw = rowsRaw[r]?.[c];
    if (raw != null && raw !== '') return raw;
    return rowsFormatted[r]?.[c] ?? null;
}

function afsFindUrlInRow(ws, r, rowsFormatted, rowsRaw, preferCol) {
    const cols = new Set();
    if (preferCol != null) {
        cols.add(preferCol);
        cols.add(preferCol + 1);
        cols.add(preferCol - 1);
    }
    const maxC = Math.max(
        (rowsRaw[r] || []).length,
        (rowsFormatted[r] || []).length,
        preferCol != null ? preferCol + 2 : 0
    );
    for (let c = 0; c < maxC; c++) cols.add(c);

    for (const c of cols) {
        if (c < 0) continue;
        const url = normalizePhotoUrl(afsGetSheetCell(ws, r, c, rowsFormatted, rowsRaw));
        if (url && /^https?:\/\//i.test(url)) return url;
    }
    return null;
}

function afsDetectPhotoColumns(rows, ws, rowsFormatted, rowsRaw) {
    const keyHeaderRe = /c[óo]digo|chave|foto do bem|key|\bid\b/i;
    const urlHeaderRe = /link|download|url|http/i;
    for (let r = 0; r < Math.min(8, rows.length); r++) {
        const row = rowsFormatted[r] || [];
        let keyCol = -1;
        let urlCol = -1;
        for (let c = 0; c < row.length; c++) {
            const cell = row[c] == null ? '' : String(row[c]).trim();
            if (!cell) continue;
            if (keyCol === -1 && keyHeaderRe.test(cell)) keyCol = c;
            if (urlHeaderRe.test(cell)) urlCol = c;
        }
        if (keyCol !== -1 && urlCol !== -1 && keyCol !== urlCol) {
            return { keyCol, urlCol };
        }
    }

    const keyPattern = /^\d+\.\d+(\.\d+)?$/;
    const colKeyScores = {};
    const colUrlScores = {};
    for (let r = 0; r < Math.min(80, rows.length); r++) {
        for (let c = 0; c < 20; c++) {
            const cell = afsGetSheetCell(ws, r, c, rowsFormatted, rowsRaw);
            if (cell == null || cell === '') continue;
            const s = String(cell).trim();
            const url = normalizePhotoUrl(cell);
            if (url && /^https?:\/\//i.test(url)) colUrlScores[c] = (colUrlScores[c] || 0) + 1;
            else if (keyPattern.test(afsFormatPhotoKey(cell) || '')) {
                colKeyScores[c] = (colKeyScores[c] || 0) + (/\.\d+$/.test(s) && s.split('.').length >= 3 ? 3 : 1);
            }
        }
    }
    const bestKey = Object.keys(colKeyScores).sort((a, b) => colKeyScores[b] - colKeyScores[a])[0];
    const bestUrl = Object.keys(colUrlScores).sort((a, b) => colUrlScores[b] - colUrlScores[a])[0];
    if (bestKey != null && bestUrl != null) {
        return { keyCol: Number(bestKey), urlCol: Number(bestUrl) };
    }
    return null;
}

function afsScoreColumnPair(rows, ws, rowsFormatted, rowsRaw, keyCol, urlCol) {
    let score = 0;
    for (let r = 0; r < rows.length; r++) {
        const key = afsFormatPhotoKey(afsGetSheetCell(ws, r, keyCol, rowsFormatted, rowsRaw));
        const url = afsFindUrlInRow(ws, r, rowsFormatted, rowsRaw, urlCol);
        if (!key || !url) continue;
        if (/^(c[óo]digo|chave|key|id|link|download|url|nome)/i.test(key)) continue;
        score += 1;
        if (/^\d+\.\d+\.\d+$/.test(key)) score += 4;
        else if (/^\d+\.\d+$/.test(key)) score += 1;
    }
    return score;
}

function afsBuildSheetLookupFromWorksheet(ws, sheetName) {
    const empty = { lookup: {}, sheetName, count: 0, keyCol: null, urlCol: null };
    if (!ws) return empty;

    const rowsFormatted = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const rows = rowsFormatted;

    const detected = afsDetectPhotoColumns(rows, ws, rowsFormatted, rowsRaw);
    const candidatePairs = [];
    if (detected) candidatePairs.push([detected.keyCol, detected.urlCol]);
    candidatePairs.push(
        [1, 3], // B → D (Coletum)
        [0, 2], // A → C
        [0, 3], // A → D
        [1, 2], // B → C
        [XLSX.utils.decode_col('BB'), XLSX.utils.decode_col('DD')],
        [0, 1]
    );

    let bestPair = null;
    let bestScore = 0;
    for (const [keyCol, urlCol] of candidatePairs) {
        if (keyCol == null || urlCol == null || keyCol === urlCol) continue;
        const score = afsScoreColumnPair(rows, ws, rowsFormatted, rowsRaw, keyCol, urlCol);
        if (score > bestScore) {
            bestScore = score;
            bestPair = [keyCol, urlCol];
        }
    }
    if (!bestPair || bestScore === 0) return empty;

    const [keyCol, urlCol] = bestPair;
    const lookup = {};
    for (let r = 0; r < rows.length; r++) {
        const key = afsFormatPhotoKey(afsGetSheetCell(ws, r, keyCol, rowsFormatted, rowsRaw));
        const url = afsFindUrlInRow(ws, r, rowsFormatted, rowsRaw, urlCol);
        if (!key || !url) continue;
        if (/^(c[óo]digo|chave|key|id|link|download|url|nome)/i.test(key)) continue;
        afsRegisterPhotoKey(lookup, key, url);
    }

    return {
        lookup,
        sheetName,
        count: Object.keys(lookup).length,
        keyCol,
        urlCol
    };
}

function afsFindPhotoSheet(wb, kind) {
    if (!wb?.SheetNames) return null;
    const names = wb.SheetNames.map(n => String(n).trim());
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

    if (kind === 'bem') {
        return names.find(n => /foto\s*do\s*bem/i.test(n) && !/espec|tag/i.test(n))
            || names.find(n => /foto\s*do\s*bem/i.test(n));
    }
    if (kind === 'spec') {
        return names.find(n => /foto\s*espec/i.test(n));
    }
    if (kind === 'tag') {
        return names.find(n => /foto\s*(da\s*)?tag/i.test(n))
            || names.find(n => /foto.*tag/i.test(n) && !/espec/i.test(n))
            || names.find(n => {
                const x = norm(n);
                return (x.includes('tag') || x.includes('plaqueta')) && x.includes('foto') && !x.includes('espec') && !x.includes('do bem');
            })
            || names.find(n => /^foto\s*tag$/i.test(n));
    }
    return null;
}

function afsBuildSheetLookup(wb, kind) {
    const empty = { lookup: {}, sheetName: null, count: 0 };
    const sheetName = afsFindPhotoSheet(wb, kind);
    if (!sheetName) return empty;
    const ws = wb.Sheets[sheetName];
    return afsBuildSheetLookupFromWorksheet(ws, sheetName);
}

function afsAssetCodeFromRow(row) {
    if (!row) return null;
    return afsFormatPhotoKey(row['A']);
}

function afsParsePhotoCount(val) {
    if (val == null || val === '') return 0;
    const s = String(val).trim();
    if (/^foto(\s|$|\.)/i.test(s)) return 1;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
}

function afsFindHeaderLetter(headers, pattern) {
    if (!headers) return null;
    const h = headers.find(x => pattern.test(String(x.name || '')));
    return h ? h.letter : null;
}

function afsDetectPhotoCountColumns(headers) {
    return {
        bem: afsFindHeaderLetter(headers, /^foto do bem$/i) || afsFindHeaderLetter(headers, /foto do bem 1/i),
        spec: afsFindHeaderLetter(headers, /foto espec/i),
        tag: afsFindHeaderLetter(headers, /foto da tag|^foto tag$/i)
    };
}

function afsBuildAllPhotoLookups(wb) {
    const bem = afsBuildSheetLookup(wb, 'bem');
    const spec = afsBuildSheetLookup(wb, 'spec');
    const tag = afsBuildSheetLookup(wb, 'tag');
    return {
        bem: bem.lookup,
        spec: spec.lookup,
        tag: tag.lookup,
        _meta: {
            sheets: { bem: bem.sheetName, spec: spec.sheetName, tag: tag.sheetName },
            counts: { bem: bem.count, spec: spec.count, tag: tag.count },
            columns: {
                bem: bem.keyCol != null ? `${XLSX.utils.encode_col(bem.keyCol)}→${XLSX.utils.encode_col(bem.urlCol)}` : null,
                spec: spec.keyCol != null ? `${XLSX.utils.encode_col(spec.keyCol)}→${XLSX.utils.encode_col(spec.urlCol)}` : null,
                tag: tag.keyCol != null ? `${XLSX.utils.encode_col(tag.keyCol)}→${XLSX.utils.encode_col(tag.urlCol)}` : null
            },
            allSheetNames: wb?.SheetNames || []
        }
    };
}

function afsBuildPhotoLookupFromWorkbook(wb) {
    const all = afsBuildAllPhotoLookups(wb);
    return { ...all.bem, ...all.spec, ...all.tag };
}

function afsGetPhotoLookups(spreadsheet) {
    return afsNormalizeLookups(spreadsheet?.photo_lookups || spreadsheet?.photo_lookup);
}

function afsNormalizeLookups(photoLookups) {
    if (!photoLookups) return { bem: {}, spec: {}, tag: {} };
    if (photoLookups.bem || photoLookups.spec || photoLookups.tag) {
        return { bem: photoLookups.bem || {}, spec: photoLookups.spec || {}, tag: photoLookups.tag || {} };
    }
    return { bem: photoLookups, spec: {}, tag: {} };
}

function afsLookupInCategory(lookup, assetCode, index) {
    if (!lookup || assetCode == null) return null;
    const base = afsFormatPhotoKey(assetCode);
    if (!base) return null;

    const candidates = [
        `${base}.${index}`,
        `${base}.${index}.0`
    ];
    if (index === 0) candidates.push(base);

    for (const k of candidates) {
        if (lookup[k]) return lookup[k];
    }

    for (const k of Object.keys(lookup)) {
        const kn = afsFormatPhotoKey(k);
        if (!kn) continue;
        if (kn === `${base}.${index}` || kn === `${base}.${index}.0`) return lookup[k];
        if (index === 0 && kn === base) return lookup[k];
        if (kn.startsWith(`${base}.${index}`)) return lookup[k];
    }
    return null;
}

function afsCollectPhotosForRow(row, mappings, photoLookups, headers) {
    const photos = [];
    const code = afsAssetCodeFromRow(row);
    if (!code) return photos;

    const lk = afsNormalizeLookups(photoLookups);
    const auto = afsDetectPhotoCountColumns(headers);
    const bemLetter = (mappings && mappings.photo_original) || auto.bem;
    const specLetter = (mappings && mappings.photo_spec) || auto.spec;
    const tagLetter = (mappings && mappings.photo_tag) || auto.tag;

    const seen = new Set();

    const addCategory = (letter, lookup, label) => {
        const count = letter ? afsParsePhotoCount(row[letter]) : 0;
        for (let i = 0; i < count; i++) {
            const key = `${code}.${i}`;
            const url = afsLookupInCategory(lookup, code, i);
            if (!url || seen.has(url)) continue;
            if (!/^https?:\/\//i.test(url)) continue;
            photos.push({
                url,
                type: count > 1 ? `${label} ${i + 1}/${count}` : label,
                key,
                category: label
            });
            seen.add(url);
        }
    };

    addCategory(bemLetter, lk.bem, 'Foto do Bem');
    addCategory(specLetter, lk.spec, 'Foto Especificações');
    addCategory(tagLetter, lk.tag, 'Foto da TAG');

    return photos;
}

function afsDebugPhotoResolution(row, mappings, photoLookups, headers) {
    const code = afsAssetCodeFromRow(row);
    const lk = afsNormalizeLookups(photoLookups);
    const auto = afsDetectPhotoCountColumns(headers);
    const bemLetter = (mappings && mappings.photo_original) || auto.bem;
    const specLetter = (mappings && mappings.photo_spec) || auto.spec;
    const tagLetter = (mappings && mappings.photo_tag) || auto.tag;

    const tryKey = (lookup, i) => {
        const key = `${code}.${i}`;
        const url = afsLookupInCategory(lookup, code, i);
        return { key, url, found: Boolean(url) };
    };

    const bemKeys = Object.keys(lk.bem);
    const nearKeys = bemKeys.filter(k => k.includes(String(code).split('.')[0] || code)).slice(0, 5);

    return {
        colA: row['A'],
        assetCode: code,
        countColumns: {
            bem: { letter: bemLetter, raw: bemLetter ? row[bemLetter] : null, count: bemLetter ? afsParsePhotoCount(row[bemLetter]) : 0 },
            spec: { letter: specLetter, raw: specLetter ? row[specLetter] : null, count: specLetter ? afsParsePhotoCount(row[specLetter]) : 0 },
            tag: { letter: tagLetter, raw: tagLetter ? row[tagLetter] : null, count: tagLetter ? afsParsePhotoCount(row[tagLetter]) : 0 }
        },
        lookupSizes: {
            bem: bemKeys.length,
            spec: Object.keys(lk.spec).length,
            tag: Object.keys(lk.tag).length
        },
        sampleKeys: {
            bem: tryKey(lk.bem, 0),
            bem1: tryKey(lk.bem, 1),
            tag: tryKey(lk.tag, 0)
        },
        nearKeys,
        bemKeySamples: bemKeys.slice(0, 5),
        photos: afsCollectPhotosForRow(row, mappings, photoLookups, headers)
    };
}

function afsResolveRowPhotos(row, headers, photoLookups, mappings) {
    return row;
}

function afsResolveAllRowsPhotos(spreadsheet, mappings) {
    if (!spreadsheet?.rows) return spreadsheet?.rows || [];
    return spreadsheet.rows;
}

window.normalizePhotoUrl = normalizePhotoUrl;
window.afsAssetCodeFromRow = afsAssetCodeFromRow;
window.afsFormatPhotoKey = afsFormatPhotoKey;
window.afsBuildAllPhotoLookups = afsBuildAllPhotoLookups;
window.afsBuildPhotoLookupFromWorkbook = afsBuildPhotoLookupFromWorkbook;
window.afsCollectPhotosForRow = afsCollectPhotosForRow;
window.afsDebugPhotoResolution = afsDebugPhotoResolution;
window.afsParsePhotoCount = afsParsePhotoCount;
window.afsGetPhotoLookups = afsGetPhotoLookups;
window.afsNormalizeLookups = afsNormalizeLookups;
