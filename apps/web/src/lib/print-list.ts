/**
 * Schlanke A4-Querformat-Druckliste (reine Tabelle, ohne Briefkopf/Template).
 */

export type PrintListColumn = {
  header: string;
  /** CSS width hint, z. B. "8%" oder "4cm" – optional. */
  width?: string;
};

/**
 * Öffnet einen temporären Druckdialog mit DIN-A4 Querformat und einer Tabelle.
 * Nur Spalten + Titelzeile – kein Briefkopf, keine Karten.
 */
export function printLandscapeList(opts: {
  title: string;
  subtitle?: string;
  columns: PrintListColumn[];
  rows: string[][];
}): void {
  const { title, subtitle, columns, rows } = opts;
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    window.alert(
      'Pop-up blockiert. Bitte Pop-ups für Office erlauben und erneut drucken.',
    );
    return;
  }

  const th = columns
    .map(
      (c) =>
        `<th${c.width ? ` style="width:${escapeAttr(c.width)}"` : ''}>${escapeHtml(c.header)}</th>`,
    )
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');

  const printedAt = new Date().toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 9pt;
      color: #000;
      background: #fff;
    }
    h1 {
      margin: 0 0 2mm;
      font-size: 12pt;
      font-weight: 600;
    }
    .meta {
      margin: 0 0 4mm;
      font-size: 8pt;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 0.4pt solid #999;
      padding: 1.5mm 2mm;
      text-align: left;
      vertical-align: top;
      overflow: hidden;
      word-wrap: break-word;
    }
    th {
      background: #eee;
      font-weight: 600;
      font-size: 8pt;
    }
    tr:nth-child(even) td { background: #fafafa; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(subtitle ?? '')}${subtitle ? ' · ' : ''}${rows.length} Einträge · gedruckt ${escapeHtml(printedAt)}</p>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${body || `<tr><td colspan="${columns.length}">Keine Einträge</td></tr>`}</tbody>
  </table>
</body>
</html>`);
  win.document.close();

  const trigger = (): void => {
    win.focus();
    win.print();
  };

  if (win.document.readyState === 'complete') {
    setTimeout(trigger, 50);
  } else {
    win.addEventListener('load', () => setTimeout(trigger, 50));
  }

  win.onafterprint = () => {
    win.close();
  };
}

/** Lädt alle Seiten einer paginierten Liste (API-Limit typ. 100). */
export async function fetchAllPages<T>(
  fetchPage: (
    page: number,
    limit: number,
  ) => Promise<{ data: T[]; totalPages?: number; total?: number }>,
  limit = 100,
): Promise<T[]> {
  const first = await fetchPage(1, limit);
  const totalPages =
    first.totalPages ??
    Math.max(1, Math.ceil((first.total ?? first.data.length) / limit));
  const all = [...first.data];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page, limit);
    all.push(...next.data);
  }
  return all;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
