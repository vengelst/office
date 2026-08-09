import type { OcrResult, TextBlock } from '../ocr/ocr.service';
import type {
  WorkCardExtractionResult,
  WorkCardExtractedFields,
  WorkCardFieldMapping,
  WorkCardFieldTarget,
  WorkCardFieldZone,
} from './work-card-field.types';

export interface ExtractImageSize {
  width: number;
  height: number;
}

/**
 * Extrahiert strukturierte Felder aus einem OCR-Ergebnis anhand von Template-Mappings.
 *
 * Algorithmus pro Mapping:
 *  0. Wenn Zone gesetzt: OCR-Blöcke in der Zone bevorzugen (+ optional Regex)
 *  1. Fallback: Label-Zeile finden (case-insensitive contains auf labelHints)
 *  2. Wert aus derselben Zeile nach ":" / Rest, oder nächste captureLines Zeilen
 *  3. Optional: Regex-Match auf den Wert
 */
export function extractWorkCardFields(
  ocr: OcrResult,
  mappings: WorkCardFieldMapping[],
  imageSize?: ExtractImageSize,
): WorkCardExtractionResult {
  const lines = ocr.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fields: WorkCardExtractedFields = {};
  const warnings: string[] = [];
  let totalConfidence = 0;
  let fieldCount = 0;

  for (const mapping of mappings) {
    const { target, labelHints = [], regex, captureLines, zone } = mapping;
    const linesToCapture = captureLines ?? 1;

    let value: string | null = null;
    let confidence = 0;

    // ── Zone zuerst (wenn gesetzt und Bildgröße bekannt) ──
    if (zone && imageSize && imageSize.width > 0 && imageSize.height > 0) {
      const zoneValue = extractFromZone(ocr.blocks, zone, imageSize, regex);
      if (zoneValue) {
        value = zoneValue.value;
        confidence = zoneValue.confidence;
      }
    }

    // ── Fallback: Label / Regex ──
    if (!value) {
      const labelIndex =
        labelHints.length > 0 ? findLabelLine(lines, labelHints) : -1;

      if (labelIndex >= 0) {
        const labelLine = lines[labelIndex];
        const afterColon = extractAfterSeparator(labelLine);

        if (afterColon && afterColon.trim().length > 0) {
          value = afterColon.trim();
          confidence = 0.7;
        }

        if ((!value || value.length === 0) && linesToCapture >= 1) {
          const captured: string[] = [];
          for (let i = 1; i <= linesToCapture && labelIndex + i < lines.length; i++) {
            const nextLine = lines[labelIndex + i];
            if (looksLikeNewLabel(nextLine)) break;
            captured.push(nextLine);
          }
          if (captured.length > 0) {
            value = captured.join('\n').trim();
            confidence = 0.6;
          }
        }
      }

      if (regex && value) {
        try {
          const re = new RegExp(regex, 'i');
          const match = value.match(re);
          if (match) {
            value = match[1] ?? match[0];
            confidence = Math.max(confidence, 0.8);
          } else {
            warnings.push(
              `${target}: Regex "${regex}" trifft nicht auf "${truncate(value)}" zu`,
            );
            confidence = Math.max(confidence - 0.2, 0.1);
          }
        } catch {
          warnings.push(`${target}: Ungültiger Regex "${regex}"`);
        }
      }

      if (!value && regex) {
        try {
          const re = new RegExp(regex, 'gi');
          const fullMatch = ocr.text.match(re);
          if (fullMatch && fullMatch.length > 0) {
            const reCapture = new RegExp(regex, 'i');
            const m = fullMatch[0].match(reCapture);
            value = m ? (m[1] ?? m[0]) : fullMatch[0];
            confidence = 0.5;
          }
        } catch {
          // already warned above
        }
      }
    }

    if (value) {
      fields[target as keyof WorkCardExtractedFields] = value;
      totalConfidence += confidence;
      fieldCount++;
    } else {
      warnings.push(`${target}: Kein Wert gefunden`);
    }
  }

  return {
    fields,
    warnings,
    confidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
  };
}

/**
 * Sammelt OCR-Blöcke, deren Mittelpunkt in der normierten Zone liegt.
 */
function extractFromZone(
  blocks: TextBlock[],
  zone: WorkCardFieldZone,
  imageSize: ExtractImageSize,
  regex?: string,
): { value: string; confidence: number } | null {
  const zx0 = clamp01(zone.x);
  const zy0 = clamp01(zone.y);
  const zx1 = clamp01(zone.x + zone.w);
  const zy1 = clamp01(zone.y + zone.h);
  if (zx1 <= zx0 || zy1 <= zy0) return null;

  const inZone: Array<{ text: string; confidence: number; y: number; x: number }> =
    [];

  for (const block of blocks) {
    const box = block.boundingBox;
    if (!box || !block.text?.trim()) continue;

    const cx = (box.x + box.width / 2) / imageSize.width;
    const cy = (box.y + box.height / 2) / imageSize.height;
    if (cx >= zx0 && cx <= zx1 && cy >= zy0 && cy <= zy1) {
      inZone.push({
        text: block.text.trim(),
        confidence: block.confidence,
        y: cy,
        x: cx,
      });
    }
  }

  if (inZone.length === 0) return null;

  // Lesereihenfolge: oben → unten, dann links → rechts
  inZone.sort((a, b) => a.y - b.y || a.x - b.x);
  let value = inZone.map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim();
  const avgConf =
    inZone.reduce((s, b) => s + b.confidence, 0) / inZone.length;

  if (regex) {
    try {
      const re = new RegExp(regex, 'i');
      const match = value.match(re);
      if (match) {
        value = (match[1] ?? match[0]).trim();
        return { value, confidence: Math.min(0.95, avgConf + 0.1) };
      }
      // Regex trifft nicht – Zone-Rohtext trotzdem nutzen (höher als Label-Fallback)
    } catch {
      // ungültiger Regex: Rohtext behalten
    }
  }

  return { value, confidence: Math.min(0.9, Math.max(avgConf, 0.75)) };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function findLabelLine(lines: string[], labelHints: string[]): number {
  for (const hint of labelHints) {
    const lower = hint.toLowerCase();
    const idx = lines.findIndex((line) => line.toLowerCase().includes(lower));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractAfterSeparator(line: string): string | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx >= 0 && colonIdx < line.length - 1) {
    return line.substring(colonIdx + 1);
  }
  const tabIdx = line.indexOf('\t');
  if (tabIdx >= 0 && tabIdx < line.length - 1) {
    return line.substring(tabIdx + 1);
  }
  return null;
}

function looksLikeNewLabel(line: string): boolean {
  if (line.includes(':') && line.indexOf(':') < 30) return true;
  const lower = line.toLowerCase();
  const knownLabels = [
    'positions-id',
    'kennung',
    'arbeitsumfang',
    'geschoss',
    'raum',
    'typ',
    'detail',
    'floor',
    'room',
    'scope',
    'title',
  ];
  return knownLabels.some((l) => lower.startsWith(l));
}

function truncate(s: string, max = 50): string {
  return s.length > max ? s.substring(0, max) + '…' : s;
}

/**
 * Erzeugt heuristische Feld-Vorschläge aus OCR-Text (für Calibrate).
 */
export function suggestFieldMappings(
  ocrText: string,
): Array<{
  target: WorkCardFieldTarget;
  labelHints: string[];
  regex?: string;
  sampleValue?: string;
}> {
  const lines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
  const suggestions: Array<{
    target: WorkCardFieldTarget;
    labelHints: string[];
    regex?: string;
    sampleValue?: string;
  }> = [];

  const labelMap: Array<{
    target: WorkCardFieldTarget;
    labels: string[];
    regex?: string;
  }> = [
    {
      target: 'itemKey',
      labels: ['Positions-ID', 'Kennung', 'Position', 'Pos.-ID', 'Pos-Nr', 'Item-Key'],
      regex: '\\d{2}-[A-Z]-\\d{2}',
    },
    {
      target: 'workScopeDe',
      labels: ['Arbeitsumfang', 'Arbeitsinhalt', 'Leistungsumfang', 'Scope', 'Aufgabe'],
    },
    {
      target: 'floor',
      labels: ['Geschoss', 'Etage', 'Floor', 'OG', 'UG', 'EG'],
    },
    {
      target: 'room',
      labels: ['Raum', 'Room', 'Zimmer', 'Lage'],
    },
    {
      target: 'title',
      labels: ['Titel', 'Title', 'Bezeichnung', 'Arbeitskarte'],
    },
  ];

  for (const entry of labelMap) {
    for (const label of entry.labels) {
      const lower = label.toLowerCase();
      const lineIdx = lines.findIndex((l) => l.toLowerCase().includes(lower));
      if (lineIdx >= 0) {
        const afterSep = extractAfterSeparator(lines[lineIdx]);
        let sampleValue = afterSep?.trim() || undefined;
        if (!sampleValue && lineIdx + 1 < lines.length) {
          sampleValue = lines[lineIdx + 1];
        }
        suggestions.push({
          target: entry.target,
          labelHints: [label],
          regex: entry.regex,
          sampleValue,
        });
        break;
      }
    }
  }

  return suggestions;
}

/** Liest Breite/Höhe aus einem PNG-Buffer (IHDR). */
export function getPngDimensions(buf: Buffer): ExtractImageSize {
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Kein gültiges PNG (IHDR fehlt)');
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}
