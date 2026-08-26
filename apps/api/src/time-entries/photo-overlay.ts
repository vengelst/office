/**
 * Brennt einen Kommentar als Label/Banner in ein Baustellenfoto (SVG via sharp).
 * Text-, Hintergrund- und Randfarbe richten sich nach der lokalen Bildhelligkeit.
 * EXIF-Orientierung wird immer in die Pixel übernommen (Hochkant bleibt Hochkant).
 *
 * Braucht System-Fonts (DejaVu) im Container – sonst nur Balken ohne Text.
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

/** Relative Luminanz darüber → dunkler Text auf hellem Grund. */
const LUMINANCE_LIGHT_THRESHOLD = 0.55;

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

export interface OverlayColors {
  text: string;
  background: string;
  /** Sichtbarer Rand – kontrastreich zur Bildhelligkeit. */
  border: string;
}

/**
 * Wählt Kontrastfarben anhand mittlerer Luminanz (0–1).
 * Hell → dunkler Text/Rand auf hellem Grund; dunkel → hell auf dunklem Grund.
 */
export function colorsForLuminance(luminance: number): OverlayColors {
  if (luminance >= LUMINANCE_LIGHT_THRESHOLD) {
    return {
      text: '#111111',
      background: 'rgba(255,255,255,0.92)',
      border: '#111111',
    };
  }
  return {
    text: '#ffffff',
    background: 'rgba(0,0,0,0.82)',
    border: '#ffffff',
  };
}

/**
 * Misst die mittlere relative Luminanz in einem Bildausschnitt (0–1).
 * Bei Fehlern: 0.25 (dunkler Fallback → weißer Text).
 */
export async function sampleRegionLuminance(
  buffer: Buffer,
  region: { left: number; top: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
): Promise<number> {
  let left = Math.max(0, Math.floor(region.left));
  let top = Math.max(0, Math.floor(region.top));
  let width = Math.max(1, Math.floor(region.width));
  let height = Math.max(1, Math.floor(region.height));
  if (left >= imageWidth || top >= imageHeight) return 0.25;
  width = Math.min(width, imageWidth - left);
  height = Math.min(height, imageHeight - top);
  if (width < 1 || height < 1) return 0.25;

  try {
    const { data, info } = await sharp(buffer, { failOn: 'none' })
      .extract({ left, top, width, height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    if (channels < 3 || data.length < channels) return 0.25;

    let sum = 0;
    let count = 0;
    const pixelCount = Math.floor(data.length / channels);
    const step = Math.max(1, Math.floor(pixelCount / 256));
    for (let i = 0; i + 2 < data.length; i += channels * step) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count += 1;
    }
    if (count === 0) return 0.25;
    return sum / count;
  } catch {
    return 0.25;
  }
}

/**
 * Übernimmt EXIF-Orientierung in die Pixel und liefert JPEG.
 * Ohne Kommentar: nur Normierung; mit Kommentar: Label/Banner einbrennen.
 */
export async function burnCommentIntoImage(
  buffer: Buffer,
  mimeType: string,
  comment: string | undefined | null,
  options?: BurnCommentOptions,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!/^image\//.test(mimeType) || mimeType.includes('svg')) {
    return { buffer, mimeType };
  }

  try {
    // .rotate() ohne Winkel = EXIF auto-orient → Hochkant bleibt Hochkant.
    const oriented = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();

    const text = comment?.trim();
    if (!text) {
      return { buffer: oriented, mimeType: 'image/jpeg' };
    }

    const image = sharp(oriented, { failOn: 'none' });
    const meta = await image.metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 900;
    const fontSize = Math.max(20, Math.min(42, Math.round(width / 28)));
    const padding = Math.round(fontSize * 0.55);
    const lineHeight = Math.round(fontSize * 1.35);
    const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.55)));
    const lines = wrapLines(text, maxChars);
    if (lines.length === 0) {
      return { buffer: oriented, mimeType: 'image/jpeg' };
    }
    const barHeight = padding * 2 + lines.length * lineHeight;
    const fontPath = resolveFontFile();
    const fontFamily = fontPath
      ? 'OverlayFont, DejaVu Sans, sans-serif'
      : 'DejaVu Sans, Liberation Sans, Arial, sans-serif';
    const defs = fontFaceCss(fontPath);
    const cornerRadius = Math.max(12, Math.round(fontSize * 0.55));
    const strokeWidth = Math.max(2, Math.round(fontSize * 0.08));

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
            Math.round(
              fontSize * 0.55 * Math.max(...lines.map((l) => l.length)),
            ),
        ),
      );
      let left = Math.round(xNorm * width - labelWidth / 2);
      let top = Math.round(yNorm * height - barHeight / 2);
      left = Math.min(Math.max(8, left), width - labelWidth - 8);
      top = Math.min(Math.max(8, top), height - barHeight - 8);
      const textX = left + padding;

      const luminance = await sampleRegionLuminance(
        oriented,
        { left, top, width: labelWidth, height: barHeight },
        width,
        height,
      );
      const colors = colorsForLuminance(luminance);

      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect x="${left}" y="${top}" width="${labelWidth}" height="${barHeight}"
        rx="${cornerRadius}" ry="${cornerRadius}"
        fill="${colors.background}"
        stroke="${colors.border}" stroke-width="${strokeWidth}"/>
  <text x="${textX}" y="${top + padding + fontSize}"
        font-family="${fontFamily}"
        font-size="${fontSize}" fill="${colors.text}" font-weight="700">${buildTspans(lines, textX, lineHeight)}</text>
</svg>`;

      out = await image
        .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    } else {
      const textX = padding;
      const sampleH = Math.min(
        height,
        Math.max(barHeight, Math.round(height * 0.12)),
      );
      const luminance = await sampleRegionLuminance(
        oriented,
        {
          left: 0,
          top: Math.max(0, height - sampleH),
          width,
          height: sampleH,
        },
        width,
        height,
      );
      const colors = colorsForLuminance(luminance);
      const bannerRadius = Math.max(10, Math.round(cornerRadius * 0.75));

      const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}"
        width="${width - strokeWidth}" height="${barHeight - strokeWidth}"
        rx="${bannerRadius}" ry="${bannerRadius}"
        fill="${colors.background}"
        stroke="${colors.border}" stroke-width="${strokeWidth}"/>
  <text x="${textX}" y="${padding + fontSize}"
        font-family="${fontFamily}"
        font-size="${fontSize}" fill="${colors.text}" font-weight="700">${buildTspans(lines, textX, lineHeight)}</text>
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
