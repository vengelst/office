/**
 * Smoke: Live-Presence Labels und API-Pfad-Bau (#38).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIVE_PRESENCE_LABELS, liveScopedPath } from './live-presence';

describe('LivePresence (#38)', () => {
  it('DE-Labels für Leer-/Fehlerzustand gesetzt', () => {
    assert.equal(LIVE_PRESENCE_LABELS.title, 'Wer arbeitet jetzt?');
    assert.equal(LIVE_PRESENCE_LABELS.empty, 'Niemand eingestempelt');
    assert.ok(LIVE_PRESENCE_LABELS.error.length > 0);
  });

  it('liveScoped Query-String ohne/mit projectId', () => {
    assert.equal(liveScopedPath(), '/time-entries/live/scoped');
    assert.equal(
      liveScopedPath('proj-ä'),
      `/time-entries/live/scoped?projectId=${encodeURIComponent('proj-ä')}`,
    );
  });
});
