import { Workbook } from 'exceljs';
import type { Cell, Row, Worksheet } from 'exceljs';

/**
 * Parser für die Import-Vorlage aus SPEZ-arbeitsitems.md Abschnitt 11.
 *
 * Unterstützt:
 *  - Excel (.xlsx) mit den Blättern `Items` und `Material`
 *  - CSV je Tabelle (Trennzeichen `;`, `,` oder Tab – Autoerkennung)
 *
 * Bewusst frei von Nest-/Prisma-Abhängigkeiten, damit der Parser auch
 * aus Skripten (siehe apps/api/scripts/) heraus nutzbar ist.
 */

/** Eine Zeile des Blatts `Items`. */
export interface ParsedItemRow {
  /** 1-basierte Zeilennummer in der Quelle (für Fehlermeldungen). */
  sourceRow: number;
  itemKey: string;
  blockKey?: string;
  title?: string;
  floor?: string;
  area?: string;
  room?: string;
  type?: string;
  rc?: string;
  detail?: string;
  planPage?: number;
  sheetNo?: number;
  sheetTotal?: number;
  pdfFile?: string;
  pdfPage?: number;
  workScopeDe?: string;
  workScopeSk?: string;
  siteName?: string;
  siteAddress?: string;
}

/** Eine Zeile des Blatts `Material`. */
export interface ParsedMaterialRow {
  sourceRow: number;
  itemKey: string;
  sortOrder?: number;
  qty?: string;
  qtyUnit?: string;
  materialDe: string;
  materialSk?: string;
}

export interface ParseResult {
  items: ParsedItemRow[];
  materials: ParsedMaterialRow[];
  /** Nicht-fatale Hinweise (übersprungene Zeilen, fehlende Blätter, …). */
  warnings: string[];
  /** Verarbeitete Quellen, z.B. "beispiel.xlsx#Items". */
  sources: string[];
}

/** Eine zu parsende Datei. */
export interface ParseInput {
  filename: string;
  buffer: Buffer;
  /** Erzwingt die Tabellenart bei CSV; Default: Autoerkennung. */
  kind?: 'items' | 'material';
}

export interface ParseOptions {
  /** CSV-Trennzeichen erzwingen (Default: Autoerkennung). */
  csvDelimiter?: string;
}

/** Spalten-Aliase → kanonischer Feldname (normalisiert: lowercase, ohne Sonderzeichen). */
const ITEM_COLUMNS: Record<string, keyof ParsedItemRow> = {
  blockkey: 'blockKey',
  block: 'blockKey',
  itemkey: 'itemKey',
  kennung: 'itemKey',
  positionsid: 'itemKey',
  position: 'itemKey',
  title: 'title',
  titel: 'title',
  floor: 'floor',
  geschoss: 'floor',
  area: 'area',
  bereich: 'area',
  room: 'room',
  raum: 'room',
  type: 'type',
  typ: 'type',
  rc: 'rc',
  detail: 'detail',
  planpage: 'planPage',
  planseite: 'planPage',
  sheetno: 'sheetNo',
  blattnr: 'sheetNo',
  sheettotal: 'sheetTotal',
  blttergesamt: 'sheetTotal', // "Blätter gesamt" (Umlaut wird beim Normalisieren entfernt)
  pdffile: 'pdfFile',
  pdfpage: 'pdfPage',
  workscopede: 'workScopeDe',
  workscopesk: 'workScopeSk',
  sitename: 'siteName',
  siteaddress: 'siteAddress',
};

const MATERIAL_COLUMNS: Record<string, keyof ParsedMaterialRow> = {
  itemkey: 'itemKey',
  kennung: 'itemKey',
  sortorder: 'sortOrder',
  reihenfolge: 'sortOrder',
  pos: 'sortOrder',
  qty: 'qty',
  menge: 'qty',
  qtyunit: 'qtyUnit',
  einheit: 'qtyUnit',
  materialde: 'materialDe',
  material: 'materialDe',
  materialsk: 'materialSk',
};

const ITEM_NUMBER_FIELDS = new Set(['planPage', 'sheetNo', 'sheetTotal', 'pdfPage']);

/**
 * Parst alle übergebenen Dateien und führt Item- und Materialzeilen zusammen.
 *
 * @param inputs - Excel- und/oder CSV-Dateien
 * @param options - CSV-Optionen
 * @returns Items, Materialzeilen, Warnungen und verarbeitete Quellen
 */
export async function parseWorkItemFiles(
  inputs: ParseInput[],
  options: ParseOptions = {},
): Promise<ParseResult> {
  const result: ParseResult = { items: [], materials: [], warnings: [], sources: [] };

  for (const input of inputs) {
    if (isExcel(input.filename)) {
      await parseExcel(input, result);
    } else {
      parseCsv(input, result, options);
    }
  }

  dedupeItems(result);
  return result;
}

// ── Excel ──────────────────────────────────────────────────────

function isExcel(filename: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(filename);
}

async function parseExcel(input: ParseInput, result: ParseResult): Promise<void> {
  const workbook = new Workbook();
  await workbook.xlsx.load(input.buffer as unknown as ArrayBuffer);

  const itemsSheet = findSheet(workbook.worksheets, ['items', 'positionen']);
  const materialSheet = findSheet(workbook.worksheets, ['material', 'materialien']);

  if (!itemsSheet && !materialSheet) {
    result.warnings.push(
      `${input.filename}: Kein Blatt "Items" oder "Material" gefunden (vorhanden: ${workbook.worksheets
        .map((ws) => ws.name)
        .join(', ')})`,
    );
    return;
  }

  if (itemsSheet) {
    result.sources.push(`${input.filename}#${itemsSheet.name}`);
    readRows(
      sheetToRows(itemsSheet),
      ITEM_COLUMNS,
      `${input.filename}#${itemsSheet.name}`,
      result,
      'items',
    );
  } else {
    result.warnings.push(`${input.filename}: Blatt "Items" fehlt`);
  }

  if (materialSheet) {
    result.sources.push(`${input.filename}#${materialSheet.name}`);
    readRows(
      sheetToRows(materialSheet),
      MATERIAL_COLUMNS,
      `${input.filename}#${materialSheet.name}`,
      result,
      'material',
    );
  }
}

function findSheet(sheets: Worksheet[], names: string[]): Worksheet | undefined {
  return sheets.find((ws) => names.includes(ws.name.trim().toLowerCase()));
}

/** Wandelt ein Worksheet in eine Matrix aus Zell-Texten (inkl. Kopfzeile). */
function sheetToRows(sheet: Worksheet): string[][] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row: Row) => {
    const values: string[] = [];
    const columnCount = Math.max(row.cellCount, sheet.columnCount);
    for (let col = 1; col <= columnCount; col++) {
      values.push(cellText(row.getCell(col)));
    }
    rows.push(values);
  });
  return rows;
}

/** Robuste Text-Extraktion für ExcelJS-Zellwerte (Text, Zahl, RichText, Formel, Datum). */
function cellText(cell: Cell): string {
  const value: unknown = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    if ('text' in obj) return String(obj.text ?? '').trim();
    if ('result' in obj) return String(obj.result ?? '').trim();
    if ('hyperlink' in obj) return String(obj.hyperlink ?? '').trim();
  }
  return String(value).trim();
}

// ── CSV ────────────────────────────────────────────────────────

function parseCsv(input: ParseInput, result: ParseResult, options: ParseOptions): void {
  const text = stripBom(input.buffer.toString('utf8'));
  if (text.trim().length === 0) {
    result.warnings.push(`${input.filename}: Datei ist leer`);
    return;
  }

  const delimiter = options.csvDelimiter ?? detectDelimiter(text);
  const rows = splitCsv(text, delimiter);
  if (rows.length === 0) {
    result.warnings.push(`${input.filename}: Keine Zeilen erkannt`);
    return;
  }

  const kind = input.kind ?? detectKind(rows[0]);
  result.sources.push(`${input.filename} (CSV, Trennzeichen "${delimiter}", ${kind})`);
  readRows(
    rows,
    kind === 'material' ? MATERIAL_COLUMNS : ITEM_COLUMNS,
    input.filename,
    result,
    kind,
  );
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => ({
    d,
    n: header.split(d).length - 1,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ';';
}

/** Erkennt anhand der Kopfzeile, ob es sich um Items oder Material handelt. */
function detectKind(header: string[]): 'items' | 'material' {
  const normalized = header.map(normalizeHeader);
  return normalized.includes('materialde') || normalized.includes('material')
    ? 'material'
    : 'items';
}

/** Minimaler CSV-Parser mit Unterstützung für Anführungszeichen und doppelte Quotes. */
function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

// ── Gemeinsame Zeilenverarbeitung ──────────────────────────────

function normalizeHeader(value: string): string {
  return stripBom(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Liest eine Matrix (erste Zeile = Kopf) und hängt die erkannten Zeilen an das Ergebnis.
 */
function readRows(
  rows: string[][],
  columnMap: Record<string, string>,
  source: string,
  result: ParseResult,
  kind: 'items' | 'material',
): void {
  if (rows.length < 2) {
    result.warnings.push(`${source}: Keine Datenzeilen`);
    return;
  }

  const header = rows[0].map(normalizeHeader);
  const indexByField = new Map<string, number>();
  header.forEach((name, index) => {
    const field = columnMap[name];
    if (field && !indexByField.has(field)) {
      indexByField.set(field, index);
    }
  });

  const requiredField = kind === 'items' ? 'itemKey' : 'materialDe';
  if (!indexByField.has('itemKey') || !indexByField.has(requiredField)) {
    result.warnings.push(
      `${source}: Kopfzeile ohne Pflichtspalten (erwartet u.a. itemKey${
        kind === 'material' ? ' und materialDe' : ''
      })`,
    );
    return;
  }

  for (let r = 1; r < rows.length; r++) {
    // Zeilennummer wie in Excel/CSV sichtbar (1-basiert inkl. Kopfzeile).
    const sourceRow = r + 1;
    const get = (field: string): string => {
      const index = indexByField.get(field);
      return index === undefined ? '' : (rows[r][index] ?? '').trim();
    };

    const itemKey = get('itemKey');
    if (!itemKey) {
      result.warnings.push(`${source} Zeile ${sourceRow}: itemKey fehlt – übersprungen`);
      continue;
    }

    if (kind === 'items') {
      const item: ParsedItemRow = { sourceRow, itemKey };
      for (const [field, index] of indexByField) {
        if (field === 'itemKey') continue;
        const raw = (rows[r][index] ?? '').trim();
        if (!raw) continue;
        if (ITEM_NUMBER_FIELDS.has(field)) {
          const num = toInt(raw);
          if (num === undefined) {
            result.warnings.push(
              `${source} Zeile ${sourceRow}: "${field}" ist keine Zahl ("${raw}") – ignoriert`,
            );
            continue;
          }
          (item as unknown as Record<string, unknown>)[field] = num;
        } else {
          (item as unknown as Record<string, unknown>)[field] = raw;
        }
      }
      if (!item.blockKey) {
        result.warnings.push(
          `${source} Zeile ${sourceRow}: blockKey fehlt – Item wird ohne Block importiert`,
        );
      }
      result.items.push(item);
    } else {
      const materialDe = get('materialDe');
      if (!materialDe) {
        result.warnings.push(
          `${source} Zeile ${sourceRow}: materialDe fehlt – übersprungen`,
        );
        continue;
      }
      const material: ParsedMaterialRow = { sourceRow, itemKey, materialDe };
      const sortOrder = toInt(get('sortOrder'));
      if (sortOrder !== undefined) material.sortOrder = sortOrder;
      const qty = get('qty');
      if (qty) material.qty = qty;
      const qtyUnit = get('qtyUnit');
      if (qtyUnit) material.qtyUnit = qtyUnit;
      const materialSk = get('materialSk');
      if (materialSk) material.materialSk = materialSk;
      result.materials.push(material);
    }
  }
}

function toInt(raw: string): number | undefined {
  if (!raw) return undefined;
  const num = Number(raw.replace(',', '.'));
  return Number.isFinite(num) ? Math.trunc(num) : undefined;
}

/** Letzte Zeile gewinnt, wenn ein itemKey mehrfach im Import vorkommt. */
function dedupeItems(result: ParseResult): void {
  const byKey = new Map<string, ParsedItemRow>();
  for (const item of result.items) {
    if (byKey.has(item.itemKey)) {
      result.warnings.push(
        `itemKey "${item.itemKey}" mehrfach enthalten – Zeile ${item.sourceRow} gewinnt`,
      );
    }
    byKey.set(item.itemKey, item);
  }
  result.items = [...byKey.values()];
}
