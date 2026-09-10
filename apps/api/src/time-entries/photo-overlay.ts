/**
 * Brennt Stempel (Datum/Uhrzeit/Ort) und optionalen Kommentar in ein Baustellenfoto.
 * Text-, Hintergrund- und Randfarbe richten sich nach der lokalen Bildhelligkeit.
 * EXIF-Orientierung wird immer in die Pixel übernommen (Hochkant bleibt Hochkant).
 *
 * Braucht System-Fonts (DejaVu) im Container – sonst nur Balken ohne Text.
 *
 * Zeitbasis Stempel: Serverzeit beim Verarbeiten, Zeitzone Europe/Berlin (#38).
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

const STAMP_TIMEZONE = 'Europe/Berlin';

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

export function wrapLines(text: string, maxChars: number): string[] {
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

/**
 * Datum + Uhrzeit in Europe/Berlin, Format `TT.MM.JJJJ HH:MM` (24h, führende Nullen).
 */
export function formatPhotoStampDateTime(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: STAMP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

/**
 * Koordinatenzeile mit 6 Nachkommastellen – kein Reverse-Geocoding.
 * Fehlt lat/lng oder nicht endlich → null.
 */
export function formatPhotoStampCoords(
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export interface PhotoStampInput {
  /** Serverzeit beim Verarbeiten (Default: now). */
  stampedAt?: Date;
  latitude?: number | null;
  longitude?: number | null;
  /** Optionaler Nutzerkommentar – zusätzlich zum Pflicht-Stempel. */
  comment?: string | null;
  /** Max. Zeichen pro Kommentarzeile (nur wenn Kommentar in die Banner-Zeilen fließt). */
  maxCommentChars?: number;
  /**
   * Kommentar separat positionieren (commentX/Y) → nicht in Banner-Zeilen aufnehmen.
   */
  commentSeparate?: boolean;
}

/**
 * Baut die Stempel-Zeilen: immer Datum/Uhrzeit, optional Ort, optional Kommentar.
 * Auch ohne Kommentar ist die Liste nie leer (#38 Pflicht-Stempel).
 */
export function buildPhotoStampLines(input: PhotoStampInput = {}): string[] {
  const lines: string[] = [formatPhotoStampDateTime(input.stampedAt ?? new Date())];
  const coords = formatPhotoStampCoords(input.latitude, input.longitude);
  if (coords) lines.push(coords);
  if (!input.commentSeparate) {
    const comment = input.comment?.trim();
    if (comment) {
      lines.push(...wrapLines(comment, input.maxCommentChars ?? 40));
    }
  }
  return lines;
}

export interface BurnCommentOptions {
  /** Relative X-Position 0–1 (Mitte des Labels). Ohne Wert: Banner unten. */
  xNorm?: number | null;
  /** Relative Y-Position 0–1 (Mitte des Labels). Ohne Wert: Banner unten. */
  yNorm?: number | null;
  /** GPS – wenn endlich, zweite Stempelzeile. */
  latitude?: number | null;
  longitude?: number | null;
  /** Override für Tests / reproduzierbare Stempelzeit. */
  stampedAt?: Date;
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

interface OverlayMetrics {
  width: number;
  height: number;
  fontSize: number;
  padding: number;
  lineHeight: number;
  fontPath: string | null;
  fontFamily: string;
  defs: string;
  cornerRadius: number;
  strokeWidth: number;
}

function metricsFor(width: number, height: number): OverlayMetrics {
  const fontSize = Math.max(20, Math.min(42, Math.round(width / 28)));
  const padding = Math.round(fontSize * 0.55);
  const lineHeight = Math.round(fontSize * 1.35);
  const fontPath = resolveFontFile();
  const fontFamily = fontPath
    ? 'OverlayFont, DejaVu Sans, sans-serif'
    : 'DejaVu Sans, Liberation Sans, Arial, sans-serif';
  return {
    width,
    height,
    fontSize,
    padding,
    lineHeight,
    fontPath,
    fontFamily,
    defs: fontFaceCss(fontPath),
    cornerRadius: Math.max(12, Math.round(fontSize * 0.55)),
    strokeWidth: Math.max(2, Math.round(fontSize * 0.08)),
  };
}

async function compositeBanner(
  oriented: Buffer,
  lines: string[],
  m: OverlayMetrics,
): Promise<Buffer> {
  const barHeight = m.padding * 2 + lines.length * m.lineHeight;
  const textX = m.padding;
  const sampleH = Math.min(
    m.height,
    Math.max(barHeight, Math.round(m.height * 0.12)),
  );
  const luminance = await sampleRegionLuminance(
    oriented,
    {
      left: 0,
      top: Math.max(0, m.height - sampleH),
      width: m.width,
      height: sampleH,
    },
    m.width,
    m.height,
  );
  const colors = colorsForLuminance(luminance);
  const bannerRadius = Math.max(10, Math.round(m.cornerRadius * 0.75));

  const svg = `<svg width="${m.width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  ${m.defs}
  <rect x="${m.strokeWidth / 2}" y="${m.strokeWidth / 2}"
        width="${m.width - m.strokeWidth}" height="${barHeight - m.strokeWidth}"
        rx="${bannerRadius}" ry="${bannerRadius}"
        fill="${colors.background}"
        stroke="${colors.border}" stroke-width="${m.strokeWidth}"/>
  <text x="${textX}" y="${m.padding + m.fontSize}"
        font-family="${m.fontFamily}"
        font-size="${m.fontSize}" fill="${colors.text}" font-weight="700">${buildTspans(lines, textX, m.lineHeight)}</text>
</svg>`;

  return sharp(oriented, { failOn: 'none' })
    .composite([{ input: Buffer.from(svg), gravity: 'south' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function compositeFloatingLabel(
  base: Buffer,
  lines: string[],
  m: OverlayMetrics,
  xNorm: number,
  yNorm: number,
  /** Unterer Bereich für Stempel-Banner freilassen (px). */
  reserveBottom: number,
): Promise<Buffer> {
  const barHeight = m.padding * 2 + lines.length * m.lineHeight;
  const labelWidth = Math.min(
    m.width - 16,
    Math.max(
      Math.round(m.width * 0.35),
      m.padding * 2 +
        Math.round(
          m.fontSize * 0.55 * Math.max(...lines.map((l) => l.length)),
        ),
    ),
  );
  let left = Math.round(xNorm * m.width - labelWidth / 2);
  let top = Math.round(yNorm * m.height - barHeight / 2);
  left = Math.min(Math.max(8, left), m.width - labelWidth - 8);
  const maxTop = Math.max(8, m.height - barHeight - 8 - reserveBottom);
  top = Math.min(Math.max(8, top), maxTop);
  const textX = left + m.padding;

  const luminance = await sampleRegionLuminance(
    base,
    { left, top, width: labelWidth, height: barHeight },
    m.width,
    m.height,
  );
  const colors = colorsForLuminance(luminance);

  const svg = `<svg width="${m.width}" height="${m.height}" xmlns="http://www.w3.org/2000/svg">
  ${m.defs}
  <rect x="${left}" y="${top}" width="${labelWidth}" height="${barHeight}"
        rx="${m.cornerRadius}" ry="${m.cornerRadius}"
        fill="${colors.background}"
        stroke="${colors.border}" stroke-width="${m.strokeWidth}"/>
  <text x="${textX}" y="${top + m.padding + m.fontSize}"
        font-family="${m.fontFamily}"
        font-size="${m.fontSize}" fill="${colors.text}" font-weight="700">${buildTspans(lines, textX, m.lineHeight)}</text>
</svg>`;

  return sharp(base, { failOn: 'none' })
    .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/**
 * Übernimmt EXIF-Orientierung in die Pixel und brennt Pflicht-Stempel (+ optional Kommentar).
 * Ohne Kommentar: trotzdem Datum/Uhrzeit (und Ort bei GPS) – #38.
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

    const meta = await sharp(oriented, { failOn: 'none' }).metadata();
    const width = meta.width ?? 1200;
    const height = meta.height ?? 900;
    const m = metricsFor(width, height);
    const maxChars = Math.max(12, Math.floor(width / (m.fontSize * 0.55)));

    const hasPos =
      options?.xNorm != null &&
      options?.yNorm != null &&
      Number.isFinite(options.xNorm) &&
      Number.isFinite(options.yNorm);

    const commentText = comment?.trim() || '';
    const stampLines = buildPhotoStampLines({
      stampedAt: options?.stampedAt,
      latitude: options?.latitude,
      longitude: options?.longitude,
      comment: hasPos ? undefined : commentText || undefined,
      maxCommentChars: maxChars,
      commentSeparate: hasPos,
    });

    // Pflicht-Stempel immer als unterer Banner.
    let out = await compositeBanner(oriented, stampLines, m);

    // Positionierter Kommentar zusätzlich (nicht Stempel überdecken).
    if (hasPos && commentText) {
      const commentLines = wrapLines(commentText, maxChars);
      if (commentLines.length > 0) {
        const stampBarHeight =
          m.padding * 2 + stampLines.length * m.lineHeight;
        out = await compositeFloatingLabel(
          out,
          commentLines,
          m,
          Math.min(1, Math.max(0, options!.xNorm!)),
          Math.min(1, Math.max(0, options!.yNorm!)),
          stampBarHeight + 8,
        );
      }
    }

    return { buffer: out, mimeType: 'image/jpeg' };
  } catch {
    return { buffer, mimeType };
  }
}
