/**
 * Zielfeld-Typen für die Template-basierte Extraktion aus Arbeitskarten-OCR.
 * Muss zum Prisma-`fields`-JSON (WorkCardTemplate.fields) passen.
 */
export type WorkCardFieldTarget =
  | 'itemKey'
  | 'workScopeDe'
  | 'workScopeSk'
  | 'title'
  | 'floor'
  | 'room';

export const WORK_CARD_FIELD_TARGETS: WorkCardFieldTarget[] = [
  'itemKey',
  'workScopeDe',
  'workScopeSk',
  'title',
  'floor',
  'room',
];

/**
 * Normierte Bounding-Box relativ zur Seite (0–1).
 * x/y = linke obere Ecke, w/h = Breite/Höhe.
 */
export interface WorkCardFieldZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Eine Feldzuordnung: wie ein Zielfeld aus dem OCR-Text extrahiert wird.
 * Gespeichert als JSON-Array in `WorkCardTemplate.fields`.
 */
export interface WorkCardFieldMapping {
  target: WorkCardFieldTarget;
  /** Labels/Überschriften auf der Karte, z.B. ["Positions-ID","Kennung"] */
  labelHints?: string[];
  /** Optional: Regex auf den Wert nach dem Label oder im Gesamttext */
  regex?: string;
  /** "nächste N Zeilen nach Label" für lange Texte (workScope). Default 1. */
  captureLines?: number;
  /** Normierte Box 0–1 relativ zur Seite – OCR-Blöcke in der Zone werden bevorzugt. */
  zone?: WorkCardFieldZone;
}

/**
 * Ergebnis der Feld-Extraktion für eine einzelne Seite.
 */
export interface WorkCardExtractedFields {
  itemKey?: string;
  workScopeDe?: string;
  workScopeSk?: string;
  title?: string;
  floor?: string;
  room?: string;
}

/**
 * Ergebnis der Extraktion inkl. Metadaten.
 */
export interface WorkCardExtractionResult {
  fields: WorkCardExtractedFields;
  warnings: string[];
  confidence: number;
}
