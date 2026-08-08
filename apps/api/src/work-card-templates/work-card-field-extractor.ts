import type { OcrResult } from '../ocr/ocr.service';
import type {
  WorkCardExtractionResult,
  WorkCardExtractedFields,
  WorkCardFieldMapping,
  WorkCardFieldTarget,
} from './work-card-field.types';

/**
 * Extrahiert strukturierte Felder aus einem OCR-Ergebnis anhand von Template-Mappings.
 * Analoges Muster wie business-card.parser.ts, aber konfigurierbar über Templates.
 *
 * Algorithmus pro Mapping:
 *  1. Label-Zeile finden (case-insensitive contains auf labelHints)
 *  2. Wert aus derselben Zeile nach ":" / Rest, oder nächste captureLines Zeilen
 *  3. Optional: Regex-Match auf den Wert
 */
export function extractWorkCardFields(
  ocr: OcrResult,
  mappings: WorkCardFieldMapping[],
): WorkCardExtractionResult {
  const lines = ocr.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fields: WorkCardExtractedFields = {};
  const warnings: string[] = [];
  let totalConfidence = 0;
  let fieldCount = 0;

  for (const mapping of mappings) {
    const { target, labelHints, regex, captureLines } = mapping;
    const linesToCapture = captureLines ?? 1;

    let value: string | null = null;
    let confidence = 0;

    const labelIndex = findLabelLine(lines, labelHints);

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
          if (looksLikeNewLabel(nextLine, labelHints)) break;
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
          warnings.push(`${target}: Regex "${regex}" trifft nicht auf "${truncate(value)}" zu`);
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

function looksLikeNewLabel(line: string, currentHints: string[]): boolean {
  if (line.includes(':') && line.indexOf(':') < 30) return true;
  const lower = line.toLowerCase();
  const knownLabels = [
    'positions-id', 'kennung', 'arbeitsumfang', 'geschoss', 'raum',
    'typ', 'detail', 'floor', 'room', 'scope', 'title',
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
): Array<{ target: WorkCardFieldTarget; labelHints: string[]; regex?: string; sampleValue?: string }> {
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
