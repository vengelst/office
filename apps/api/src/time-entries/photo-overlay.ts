/**
 * Brennt einen Kommentar als Banner/Label in ein Baustellenfoto (SVG via sharp).
 * Braucht System-Fonts (DejaVu) im Container – sonst nur schwarzer Balken ohne Text.
 */

import { existsSync } from 'node:fs';
import sharp from 'sharp';

/** Bekannte Pfade für DejaVu (Alpine font-dejavu / Debian). */
const FONT_CANDIDATES = [
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];

function resolveFontFile(): string | null {
  for (const p of FONT_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function fontFaceCss(fontPath: string | null): string {
  if (!fontPath) return '';
  // file://-URL für librsvg/sharp – absolute Systemschrift einbinden
  const href = `file://${fontPath}`;
  return `<defs><style type="text/css"><![CDATA[
@font-face { font-family: "OverlayFont"; src: url("${href}"); }
]]></style></defs>`;
}

function buildTspans(
  lines: string[],
  x: number,
  lineHeight: number,
): string {
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
}

export interface BurnCommentOptions {
  /** Relative X-Position 0–1 (Mitte des Labels). Ohne Wert: Banner unten. */
  xNorm?: number | null;
  /** Relative Y-Position 0–1 (Mitte des Labels). Ohne Wert: Banner unten. */
  yNorm?: number | null;
}

/**
 * Zeichnet den Kommentar ins Bild.
 * Mit xNorm/yNorm: Label an der getippten Stelle; sonst dunkler Balken unten.
 */
export async function burnCommentIntoImage(
  buffer: Buffer,
  mimeType: string,
  comment: string | undefined | null,
  options?: BurnCommentOptions,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const text = comment?.trim();
  if (!text) {
    return { buffer, mimeType };
  }
  if (!/^image\//.test(mimeType) || mimeType.includes('svg')) {
    return { buffer, mimeType };
  }

  try {
    const image = sharp(buffer, { failOn: 'none' });
    const meta = await image.metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 900;
    const fontSize = Math.max(20, Math.min(42, Math.round(width / 28)));
    const padding = Math.round(fontSize * 0.55);
    const lineHeight = Math.round(fontSize * 1.35);
    const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.55)));
    const lines = wrapLines(text, maxChars);
    if (lines.length === 0) {
      return { buffer, mimeType };
    }
    const barHeight = padding * 2 + lines.length * lineHeight;
    const fontPath = resolveFontFile();
    const fontFamily = fontPath
      ? 'OverlayFont, DejaVu Sans, sans-serif'
      : 'DejaVu Sans, Liberation Sans, Arial, sans-serif';
    const defs = fontFaceCss(fontPath);

    const hasPos =
      options?.xNorm != null &&
      options?.yNorm != null &&
      Number.isFinite(options.xNorm) &&
      Number.isFinite(options.yNorm);

    let out: Buffer;
    if (hasPos) {
      const xNorm = Math.min(1, Math.max(0, options!.xNorm!));
      const yNorm = Math.min(1, Math.max(0, options!.yNorm!));
      const labelWidth = Math.min(
        width - 16,
        Math.max(
          Math.round(width * 0.35),
          padding * 2 +
            Math.round(fontSize * 0.55 * Math.max(...lines.map((l) => l.length))),
        ),
      );
      let left = Math.round(xNorm * width - labelWidth / 2);
      let top = Math.round(yNorm * height - barHeight / 2);
      left = Math.min(Math.max(8, left), width - labelWidth - 8);
      top = Math.min(Math.max(8, top), height - barHeight - 8);
      const textX = left + padding;

      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect x="${left}" y="${top}" width="${labelWidth}" height="${barHeight}"
        rx="8" ry="8" fill="rgba(0,0,0,0.78)"/>
  <text x="${textX}" y="${top + padding + fontSize}"
        font-family="${fontFamily}"
        font-size="${fontSize}" fill="#ffffff" font-weight="700">${buildTspans(lines, textX, lineHeight)}</text>
</svg>`;

      out = await image
        .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    } else {
      const textX = padding;
      const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)"/>
  <text x="${textX}" y="${padding + fontSize}"
        font-family="${fontFamily}"
        font-size="${fontSize}" fill="#ffffff" font-weight="700">${buildTspans(lines, textX, lineHeight)}</text>
</svg>`;

      out = await image
        .composite([{ input: Buffer.from(svg), gravity: 'south' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    }

    return { buffer: out, mimeType: 'image/jpeg' };
  } catch {
    return { buffer, mimeType };
  }
}
