/**
 * Zero-dependency exporters for the DPDP data archive (JSON → CSV / XLS / print).
 * The archive shape comes from GET/POST /users/me/data-export:
 *   { userId, generatedAt, profile: {...}, consents: {...}, collections: { name: [...] } }
 */

type Row = Record<string, unknown>;

const MAX_PRINT_ROWS = 200;

const flattenValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const unionKeys = (rows: Row[]): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
};

const sectionRows = (archive: Record<string, unknown>): { name: string; rows: Row[] }[] => {
  const sections: { name: string; rows: Row[] }[] = [];
  const profile = archive['profile'];
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    sections.push({ name: 'profile', rows: [profile as Row] });
  }
  const collections = (archive['collections'] ?? {}) as Record<string, unknown>;
  for (const [name, value] of Object.entries(collections)) {
    if (Array.isArray(value) && value.length > 0) {
      sections.push({ name, rows: value as Row[] });
    }
  }
  return sections;
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const csvCell = (v: unknown): string => {
  const s = flattenValue(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One flattened CSV: every record from every section, with a leading `section` column. */
export const buildCsv = (archive: Record<string, unknown>): string => {
  const sections = sectionRows(archive);
  const keys = unionKeys(sections.flatMap((s) => s.rows));
  const header = ['section', ...keys];
  const lines = [header.join(',')];
  for (const s of sections) {
    for (const row of s.rows) {
      lines.push([s.name, ...keys.map((k) => row[k])].map(csvCell).join(','));
    }
  }
  return lines.join('\r\n');
};

/**
 * Excel 2003 XML (SpreadsheetML) workbook — one worksheet per section. Excel
 * opens this natively (multi-sheet) without any third-party library; the user
 * can "Save As .xlsx" from Excel if needed.
 */
export const buildXls = (archive: Record<string, unknown>): string => {
  const worksheets = sectionRows(archive)
    .map(({ name, rows }) => {
      const keys = unionKeys(rows);
      const headerRow = `<Row>${keys
        .map((k) => `<Cell><Data ss:Type="String">${escapeXml(k)}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = rows
        .map((row) => {
          const cells = keys
            .map((k) => {
              const v = row[k];
              if (typeof v === 'number' && Number.isFinite(v)) {
                return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
              }
              return `<Cell><Data ss:Type="String">${escapeXml(flattenValue(v))}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');
      return `<Worksheet ss:Name="${escapeXml(name.slice(0, 31))}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
    })
    .join('');
  return (
    '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    worksheets +
    '</Workbook>'
  );
};

/** Trigger a browser download for text content. */
export const downloadTextFile = (content: string, filename: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * PDF path without a PDF library: open a clean print-ready report and let the
 * browser's "Save as PDF" produce the file.
 */
export const openPrintableReport = (archive: Record<string, unknown>): boolean => {
  const win = window.open('', '_blank');
  if (!win) return false;
  const generatedAt = flattenValue(archive['generatedAt']) || new Date().toISOString();
  const sections = sectionRows(archive)
    .map(({ name, rows }) => {
      const keys = unionKeys(rows).slice(0, 8);
      const shown = rows.slice(0, MAX_PRINT_ROWS);
      const more = rows.length - shown.length;
      const head = keys.map((k) => `<th>${escapeXml(k)}</th>`).join('');
      const body = shown
        .map((row) => `<tr>${keys.map((k) => `<td>${escapeXml(flattenValue(row[k]))}</td>`).join('')}</tr>`)
        .join('');
      return (
        `<h2>${escapeXml(name)} <small>(${rows.length} records)</small></h2>` +
        `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
        (more > 0 ? `<p class="more">… and ${more} more rows — download the CSV/Excel for the full data.</p>` : '')
      );
    })
    .join('');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"/>' +
      '<title>Agrovercity — My Data Export</title>' +
      '<style>body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#0f172a}' +
      'h1{font-size:20px}h2{font-size:14px;margin:18px 0 6px}small{color:#64748b;font-weight:400}' +
      'table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top;word-break:break-word}' +
      'th{background:#f1f5f9}.more{color:#64748b;font-size:11px}</style></head><body>' +
      `<h1>Agrovercity — My Data Export</h1><p>Generated: ${escapeXml(generatedAt)}</p>` +
      sections +
      '</body></html>'
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
};
