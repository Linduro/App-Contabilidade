export function toCSV(rows, columns) {
  const header = columns.map((c) => c.label).join(';');
  const lines = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key];
      const s = v == null ? '' : String(v);
      return s.includes(';') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';'),
  );
  return header + '\n' + lines.join('\n');
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function copyText(text) {
  return navigator.clipboard.writeText(text);
}

export function exportExcel(rows, columns, sheetName) {
  if (!window.XLSX) throw new Error('SheetJS não carregado');
  const data = [columns.map((c) => c.label)];
  rows.forEach((row) => data.push(columns.map((c) => row[c.key] ?? '')));
  const ws = window.XLSX.utils.aoa_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Leads');
  window.XLSX.writeFile(wb, 'afs-leads.xlsx');
}

export const LEAD_EXPORT_COLS = [
  { key: 'cnpj_basico', label: 'CNPJ' },
  { key: 'razao_social', label: 'Razão Social' },
  { key: 'cnae_codigo', label: 'CNAE' },
  { key: 'regime_tributario', label: 'Regime' },
  { key: 'porte_empresa', label: 'Porte' },
  { key: 'capital_social', label: 'Capital' },
  { key: 'uf', label: 'UF' },
  { key: 'score', label: 'Score' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'status_funil', label: 'Status Funil' },
  { key: 'origem', label: 'Origem' },
];
