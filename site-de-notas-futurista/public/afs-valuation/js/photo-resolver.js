// ============================================================
// AFS — Fotos Coletum (especificação exata)
// Col A (texto) + ".0"/".1"/… por QUANTIDADE nas colunas Foto do Bem / Espec / TAG
// 3 abas: "Foto do Bem", "Foto Especificações", "Foto da TAG"
// Em cada aba: chave col B, URL col D
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

/** Preserva código patrimonial como texto (ex: 31807.158) */
function afsFormatPhotoKey(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return String(val);
        const s = val.toFixed(6).replace(/\.?0+$/, '');
        return s.includes('.') ? s : String(val);
    }
    return String(val).trim().replace(/;+$/, '');
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

function afsBuildSheetLookup(wb, sheetPattern) {
    const empty = { lookup: {}, sheetName: null, count: 0 };
    if (!wb?.SheetNames) return empty;

    const sheetName = wb.SheetNames.find(n => sheetPattern.test(String(n).trim()));
    if (!sheetName) return empty;

    const ws = wb.Sheets[sheetName];
    const rowsFormatted = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    const KEY_COL = 1; // B — Código (Foto do Bem)
    const URL_COL = 3; // D — Link para download
    const lookup = {};

    for (let r = 0; r < rowsFormatted.length; r++) {
        const fmt = rowsFormatted[r] || [];
        const raw = rowsRaw[r] || [];
        const key = afsFormatPhotoKey(raw[KEY_COL] ?? fmt[KEY_COL]);
        const url = normalizePhotoUrl(raw[URL_COL] ?? fmt[URL_COL]);
        if (!key || !url || !/^https?:\/\//i.test(url)) continue;
        if (/^(c[óo]digo|chave|key|id|link|download|url|nome)/i.test(key)) continue;
        lookup[key] = url;
    }

    return { lookup, sheetName, count: Object.keys(lookup).length };
}

function afsBuildAllPhotoLookups(wb) {
    const bem = afsBuildSheetLookup(wb, /foto\s*do\s*bem/i);
    const spec = afsBuildSheetLookup(wb, /foto\s*espec/i);
    const tag = afsBuildSheetLookup(wb, /foto\s*(da\s*)?tag/i);
    return {
        bem: bem.lookup,
        spec: spec.lookup,
        tag: tag.lookup,
        _meta: {
            sheets: { bem: bem.sheetName, spec: spec.sheetName, tag: tag.sheetName },
            counts: { bem: bem.count, spec: spec.count, tag: tag.count }
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
    for (const k of candidates) {
        if (lookup[k]) return lookup[k];
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
        return { key, url: lookup[key] || null, found: Boolean(lookup[key]) };
    };

    return {
        colA: row['A'],
        assetCode: code,
        countColumns: {
            bem: { letter: bemLetter, raw: bemLetter ? row[bemLetter] : null, count: bemLetter ? afsParsePhotoCount(row[bemLetter]) : 0 },
            spec: { letter: specLetter, raw: specLetter ? row[specLetter] : null, count: specLetter ? afsParsePhotoCount(row[specLetter]) : 0 },
            tag: { letter: tagLetter, raw: tagLetter ? row[tagLetter] : null, count: tagLetter ? afsParsePhotoCount(row[tagLetter]) : 0 }
        },
        lookupSizes: {
            bem: Object.keys(lk.bem).length,
            spec: Object.keys(lk.spec).length,
            tag: Object.keys(lk.tag).length
        },
        sampleKeys: {
            bem: tryKey(lk.bem, 0),
            bem1: tryKey(lk.bem, 1),
            tag: tryKey(lk.tag, 0)
        },
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
