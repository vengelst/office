/**
 * Brennt einen Kommentar als Banner in ein Baustellenfoto (SVG-Overlay via sharp).
 */

import sharp from 'sharp';

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

/**
 * Zeichnet den Kommentar unten ins Bild (dunkler Balken, weiße Schrift).
 * Ohne Kommentar oder bei Fehler: Original-Buffer unverändert.
 */
export async function burnCommentIntoImage(
  buffer: Buffer,
  mimeType: string,
  comment: string | undefined | null,
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
    const fontSize = Math.max(20, Math.min(42, Math.round(width / 28)));
    const padding = Math.round(fontSize * 0.55);
    const lineHeight = Math.round(fontSize * 1.35);
    const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.55)));
    const lines = wrapLines(text, maxChars);
    if (lines.length === 0) {
      return { buffer, mimeType };
    }
    const barHeight = padding * 2 + lines.length * lineHeight;
    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${padding}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('');
    const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)"/>
  <text x="${padding}" y="${padding + fontSize}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}" fill="#ffffff" font-weight="600">${tspans}</text>
</svg>`;

    const out = await image
      .composite([{ input: Buffer.from(svg), gravity: 'south' }])
      .jpeg({ quality: 88 })
      .toBuffer();

    return { buffer: out, mimeType: 'image/jpeg' };
  } catch {
    return { buffer, mimeType };
  }
}
