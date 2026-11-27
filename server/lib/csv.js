const DANGEROUS_START = /^[=+\-@\t\r]/;

function cell(value, delimiter) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? String(value) : String(value);
  if (typeof value !== 'number' && DANGEROUS_START.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers, rows, { delimiter = ';' } = {}) {
  const lines = [headers.map((h) => cell(h, delimiter)).join(delimiter)];
  for (const row of rows) lines.push(row.map((v) => cell(v, delimiter)).join(delimiter));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function parseCsv(text, { maxRows = 500 } = {}) {
  const src = String(text).replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > maxRows + 1) break;
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows.map((r) => r.map((c) => (c.startsWith("'") && DANGEROUS_START.test(c.slice(1)) ? c.slice(1) : c)));
}
