/**
 * Pflicht-Foto-Stempel (#38) – Textbau und Burn-in auch ohne Kommentar.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import {
  buildPhotoStampLines,
  burnCommentIntoImage,
  formatPhotoStampDateTime,
  formatPhotoStampPlace,
} from './photo-overlay';

describe('formatPhotoStampDateTime', () => {
  it('formatiert Europe/Berlin mit führenden Nullen (24h)', () => {
    // 2026-09-10 20:15 UTC = 22:15 Europe/Berlin (Sommerzeit)
    const at = new Date('2026-09-10T20:15:00.000Z');
    assert.equal(formatPhotoStampDateTime(at), '10.09.2026 22:15');
  });

  it('Winterzeit: UTC+1', () => {
    const at = new Date('2026-01-15T10:05:00.000Z');
    assert.equal(formatPhotoStampDateTime(at), '15.01.2026 11:05');
  });
});

describe('formatPhotoStampPlace', () => {
  it('trimmt und behält Ortslabel', () => {
    assert.equal(
      formatPhotoStampPlace('  Marienplatz 1, 80331 München '),
      'Marienplatz 1, 80331 München',
    );
  });

  it('leer / null → null', () => {
    assert.equal(formatPhotoStampPlace(null), null);
    assert.equal(formatPhotoStampPlace(undefined), null);
    assert.equal(formatPhotoStampPlace('   '), null);
  });
});

describe('buildPhotoStampLines', () => {
  const at = new Date('2026-09-10T20:15:00.000Z');

  it('immer Datum/Uhrzeit – auch ohne comment', () => {
    const lines = buildPhotoStampLines({ stampedAt: at });
    assert.deepEqual(lines, ['10.09.2026 22:15']);
  });

  it('mit Ort → zweite Zeile Adresse, keine Koordinaten', () => {
    const lines = buildPhotoStampLines({
      stampedAt: at,
      placeLabel: 'Marienplatz 1, 80331 München',
    });
    assert.deepEqual(lines, [
      '10.09.2026 22:15',
      'Marienplatz 1, 80331 München',
    ]);
    assert.ok(!lines.some((l) => /\d+\.\d{4,}/.test(l) && l.includes(',')));
  });

  it('mit Kommentar → Stempel + Kommentar', () => {
    const lines = buildPhotoStampLines({
      stampedAt: at,
      comment: 'Kabel verlegt',
    });
    assert.equal(lines[0], '10.09.2026 22:15');
    assert.ok(lines.includes('Kabel verlegt'));
  });

  it('commentSeparate → Kommentar nicht in Stempelzeilen', () => {
    const lines = buildPhotoStampLines({
      stampedAt: at,
      comment: 'nur Label',
      commentSeparate: true,
    });
    assert.deepEqual(lines, ['10.09.2026 22:15']);
  });
});

describe('burnCommentIntoImage (#38 Pflicht-Stempel)', () => {
  async function tinyJpeg(): Promise<Buffer> {
    return sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('brennt Stempel auch ohne comment (Buffer ändert sich)', async () => {
    const input = await tinyJpeg();
    const stampedAt = new Date('2026-09-10T20:15:00.000Z');
    const result = await burnCommentIntoImage(input, 'image/jpeg', null, {
      stampedAt,
    });
    assert.equal(result.mimeType, 'image/jpeg');
    assert.ok(result.buffer.length > 0);
    assert.notDeepEqual(result.buffer, input);
  });

  it('mit Ort und Kommentar → erfolgreicher Overlay', async () => {
    const input = await tinyJpeg();
    const result = await burnCommentIntoImage(
      input,
      'image/jpeg',
      'Testkommentar',
      {
        stampedAt: new Date('2026-09-10T20:15:00.000Z'),
        placeLabel: 'Marienplatz 1, 80331 München',
      },
    );
    assert.equal(result.mimeType, 'image/jpeg');
    assert.ok(result.buffer.length > 100);
  });
});
