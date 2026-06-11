// ============================================================
// AFS — Resolução de fotos via aba "Foto do Bem"
// Chave: {valor_coluna_A}.{índice}  ex: A2=123 → "123.0"
// Índices: .0 = Foto do Bem 1 | .1 = Foto do Bem 2 | .2 = Foto TAG
// Lookup: coluna BB → URL coluna DD (fallback B → D)
// ============================================================

function normalizePhotoUrl(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') {
        if (raw.Target) return normalizePhotoUrl(raw.Target);
        if (raw.l) return normalizePhotoUrl(raw.l);
        if (raw.text) return normalizePhotoUrl(raw.text);
        if (raw.hyperlink) return normalizePhotoUrl(raw.hyperlink);
    }
    let s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith('=') && /HYPERLINK/i.test(s)) {
        const m = s.match(/HYPERLINK\s*\(\s*"([^"]+)"/i) || s.match(/HYPERLINK\s*\(\s*'([^']+)'/i);
        if (m) s = m[1];
    }
    const driveFile = s.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
    if (driveFile) return `https://drive.google.com/thumbnail?id=${driveFile[1]}&sz=w1200`;
    const driveOpen = s.match(/drive\.google\.com\/open\?id=([^&]+)/i);
    if (driveOpen) return `https://drive.google.com/thumbnail?id=${driveOpen[1]}&sz=w1200`;
    const driveId = s.match(/[?&]id=([^&]+)/i);
    if (/drive\.google\.com/i.test(s) && driveId) {
        return `https://drive.google.com/thumbnail?id=${driveId[1]}&sz=w1200`;
    }
    if (s.startsWith('//')) s = 'https:' + s;
    return s;
}

function afsNormalizeAssetId(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number') {
        if (Number.isInteger(val) || (val % 1 === 0)) return String(Math.trunc(val));
        return String(val);
    }
    const s = String(val).trim();
    if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, '');
    return s;
}

function afsRegisterPhotoKey(lookup, key, url) {
    const urlNorm = normalizePhotoUrl(url);
    if (!urlNorm) return;
    const keyStr = String(key).trim();
    if (!keyStr) return;
    lookup[keyStr] = urlNorm;
    const m = keyStr.match(/^(.+)\.(\d+)$/);
    if (m) {
        const base = afsNormalizeAssetId(m[1]);
        const idx = m[2];
        if (base) lookup[`${base}.${idx}`] = urlNorm;
    }
}

function afsDetectPhotoColumns(rows) {
    // 1) Detectar pela linha de cabeçalho (até 5 primeiras linhas)
    const keyHeaderRe = /c[óo]digo|chave|foto do bem|key|\bid\b/i;
    const urlHeaderRe = /link|download|url|http/i;
    for (let r = 0; r < Math.min(5, rows.length); r++) {
        const row = rows[r] || [];
        let keyCol = -1;
        let urlCol = -1;
        for (let c = 0; c < row.length; c++) {
            const cell = row[c] == null ? '' : String(row[c]).trim();
            if (!cell) continue;
            if (keyCol === -1 && keyHeaderRe.test(cell)) keyCol = c;
            if (urlHeaderRe.test(cell)) urlCol = c;
        }
        if (keyCol !== -1 && urlCol !== -1 && keyCol !== urlCol) {
            return { keyCol, urlCol, headerRow: r };
        }
    }

    // 2) Detectar pelo conteúdo: coluna com URLs http e coluna com chaves "n.n" ou "n.n.n"
    const keyPattern = /^[\w-]+\.\d+(\.\d+)?$/;
    const colScores = {};
    const urlScores = {};
    for (let r = 0; r < Math.min(60, rows.length); r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
            const cell = row[c] == null ? '' : String(row[c]).trim();
            if (!cell) continue;
            if (/^https?:\/\//i.test(cell)) urlScores[c] = (urlScores[c] || 0) + 1;
            else if (keyPattern.test(cell)) colScores[c] = (colScores[c] || 0) + 1;
        }
    }
    const bestKey = Object.keys(colScores).sort((a, b) => colScores[b] - colScores[a])[0];
    const bestUrl = Object.keys(urlScores).sort((a, b) => urlScores[b] - urlScores[a])[0];
    if (bestKey != null && bestUrl != null) {
        return { keyCol: Number(bestKey), urlCol: Number(bestUrl), headerRow: 0 };
    }
    return null;
}

function afsBuildPhotoLookupFromWorkbook(wb) {
    const lookup = {};
    if (!wb || !wb.SheetNames) return lookup;

    const sheetName = wb.SheetNames.find(n => /foto\s*do\s*bem/i.test(String(n).trim()));
    if (!sheetName) return lookup;

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

    const detected = afsDetectPhotoColumns(rows);
    const candidatePairs = [];
    if (detected) candidatePairs.push([detected.keyCol, detected.urlCol]);
    // Fallbacks: A→C (layout Coletum), A→B, BB→DD, B→D
    candidatePairs.push([0, 2], [0, 1],
        [XLSX.utils.decode_col('BB'), XLSX.utils.decode_col('DD')],
        [XLSX.utils.decode_col('B'), XLSX.utils.decode_col('D')]);

    for (const [keyCol, urlCol] of candidatePairs) {
        if (keyCol == null || urlCol == null || keyCol === urlCol) continue;
        let found = 0;
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r] || [];
            const key = row[keyCol];
            const url = row[urlCol];
            if (key == null || url == null) continue;
            const keyStr = String(key).trim();
            const urlStr = String(url).trim();
            if (!keyStr || !urlStr) continue;
            if (!/^https?:\/\//i.test(urlStr)) continue;
            if (/^(c[óo]digo|chave|key|id|link|download|url|nome)/i.test(keyStr)) continue;
            afsRegisterPhotoKey(lookup, keyStr, urlStr);
            found++;
        }
        if (found > 0) break;
    }
    return lookup;
}

function afsPhotoIndexFromHeader(headerName, fieldName) {
    if (fieldName === 'photo_original') return '0';
    if (fieldName === 'photo_spec') return '1';
    if (fieldName === 'photo_tag') return '2';
    const h = (headerName || '').toLowerCase();
    if (/foto do bem 2|especifica|especificação|especificacao/.test(h)) return '1';
    if (/foto da tag|foto tag|plaqueta|bem 3/.test(h)) return '2';
    if (/foto do bem 1|foto do bem|foto do ativo|foto original/.test(h)) return '0';
    return '0';
}

function afsIsPhotoPlaceholder(val) {
    if (val == null) return false;
    const s = String(val).trim().toLowerCase();
    return s === 'foto' || s === 'foto do bem' || s === 'imagem' || s === 'foto.';
}

function afsLookupPhotoUrl(assetId, photoIdx, photoLookup) {
    if (!photoLookup || assetId == null) return null;
    const id = afsNormalizeAssetId(assetId);
    if (!id) return null;
    const candidates = [
        `${id}.${photoIdx}`,
        `${Number(id)}.${photoIdx}`
    ];
    const num = Number(id);
    if (!Number.isNaN(num)) {
        candidates.push(`${num.toFixed(1)}.${photoIdx}`);
        candidates.push(`${Math.trunc(num)}.${photoIdx}`);
    }
    for (const k of candidates) {
        if (photoLookup[k]) return photoLookup[k];
    }
    return null;
}

function afsResolvePhotoUrl(assetId, photoIdx, photoLookup, rawCellValue) {
    const fromLookup = afsLookupPhotoUrl(assetId, photoIdx, photoLookup);
    if (fromLookup) return fromLookup;
    const direct = normalizePhotoUrl(rawCellValue);
    if (direct && /^https?:\/\//i.test(direct)) return direct;
    return null;
}

function afsResolveRowPhotos(row, headers, photoLookup, mappings) {
    if (!row) return row;
    const lookup = photoLookup || {};
    const assetId = row['A'];
    const headerMap = {};
    (headers || []).forEach(h => { if (h.letter) headerMap[h.letter] = h.name; });

    const resolved = { ...row };
    const mappedLetters = new Set();

    const photoFields = [
        { field: 'photo_original', idx: '0' },
        { field: 'photo_spec', idx: '1' },
        { field: 'photo_tag', idx: '2' }
    ];

    photoFields.forEach(({ field, idx }) => {
        const letter = mappings && mappings[field];
        if (!letter) return;
        mappedLetters.add(letter);
        const raw = row[letter];
        const headerName = headerMap[letter] || '';
        const photoIdx = afsIsPhotoPlaceholder(raw) ? afsPhotoIndexFromHeader(headerName, field) : idx;
        const url = afsResolvePhotoUrl(assetId, photoIdx, lookup, raw);
        if (url) resolved[letter] = url;
        else if (afsIsPhotoPlaceholder(raw)) resolved[letter] = null;
    });

    (headers || []).forEach(h => {
        const letter = h.letter;
        if (mappedLetters.has(letter)) return;
        const raw = row[letter];
        if (!afsIsPhotoPlaceholder(raw)) {
            const maybeUrl = normalizePhotoUrl(raw);
            if (maybeUrl && /^https?:\/\//i.test(maybeUrl)) resolved[letter] = maybeUrl;
            return;
        }
        const photoIdx = afsPhotoIndexFromHeader(h.name, null);
        const url = afsResolvePhotoUrl(assetId, photoIdx, lookup, raw);
        if (url) resolved[letter] = url;
    });

    return resolved;
}

function afsResolveAllRowsPhotos(spreadsheet, mappings) {
    if (!spreadsheet || !spreadsheet.rows) return spreadsheet.rows || [];
    return spreadsheet.rows.map(row =>
        afsResolveRowPhotos(row, spreadsheet.headers, spreadsheet.photo_lookup || {}, mappings)
    );
}

function afsCollectPhotosForRow(row, mappings, photoLookup, headers) {
    const photos = [];
    const assetId = row['A'];
    const lookup = photoLookup || {};
    const headerMap = {};
    (headers || []).forEach(h => { if (h.letter) headerMap[h.letter] = h.name; });

    const slots = [
        { field: 'photo_original', idx: '0', label: 'Foto do Bem' },
        { field: 'photo_spec', idx: '1', label: 'Foto Especificações' },
        { field: 'photo_tag', idx: '2', label: 'Foto da TAG' }
    ];

    const seen = new Set();
    for (const slot of slots) {
        let url = afsLookupPhotoUrl(assetId, slot.idx, lookup);
        const letter = mappings && mappings[slot.field];
        if (!url && letter) {
            url = afsResolvePhotoUrl(
                assetId,
                afsPhotoIndexFromHeader(headerMap[letter], slot.field),
                lookup,
                row[letter]
            );
        }
        if (!url) continue;
        url = normalizePhotoUrl(url);
        if (!url || seen.has(url)) continue;
        if (/^https?:\/\//i.test(url)) {
            photos.push({ url, type: slot.label });
            seen.add(url);
        }
    }
    return photos;
}

window.normalizePhotoUrl = normalizePhotoUrl;
window.afsBuildPhotoLookupFromWorkbook = afsBuildPhotoLookupFromWorkbook;
window.afsResolveRowPhotos = afsResolveRowPhotos;
window.afsResolveAllRowsPhotos = afsResolveAllRowsPhotos;
window.afsCollectPhotosForRow = afsCollectPhotosForRow;
window.afsNormalizeAssetId = afsNormalizeAssetId;
