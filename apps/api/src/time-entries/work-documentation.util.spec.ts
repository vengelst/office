/**
 * Validierung Arbeitsdokumentation – Unit-Tests (Auftrag #30).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateDayWorkDocs,
  validateWorkDocumentation,
} from './work-documentation.util';

describe('validateWorkDocumentation', () => {
  it('Freitext an: nur Text OK', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: true,
      activeActivityCount: 3,
      projectWorkActivityIds: [],
      workNotes: '  Kabel gezogen  ',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.notes, 'Kabel gezogen');
      assert.deepEqual(r.activityIds, []);
    }
  });

  it('Freitext an: Checkbox OK ohne Text', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: true,
      activeActivityCount: 2,
      projectWorkActivityIds: ['a1'],
      workNotes: '   ',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.notes, null);
      assert.deepEqual(r.activityIds, ['a1']);
    }
  });

  it('Freitext an: leer → 400', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: true,
      activeActivityCount: 2,
      projectWorkActivityIds: [],
      workNotes: '',
    });
    assert.equal(r.ok, false);
  });

  it('Freitext aus: ohne Checkbox → 400', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: false,
      activeActivityCount: 2,
      projectWorkActivityIds: [],
      workNotes: 'soll ignoriert werden',
    });
    assert.equal(r.ok, false);
  });

  it('Freitext aus: Checkbox OK, Notes verworfen', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: false,
      activeActivityCount: 1,
      projectWorkActivityIds: ['x'],
      workNotes: 'ignored',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.notes, null);
      assert.deepEqual(r.activityIds, ['x']);
    }
  });

  it('Keine Tätigkeiten + Freitext aus → Konfigurationsfehler', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: false,
      activeActivityCount: 0,
      projectWorkActivityIds: [],
      workNotes: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.message, /Büro/i);
    }
  });

  it('Keine Tätigkeiten + Freitext an → nur Text Pflicht', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: true,
      activeActivityCount: 0,
      projectWorkActivityIds: [],
      workNotes: 'Sonstiges',
    });
    assert.equal(r.ok, true);
  });

  it('Duplikat-IDs werden dedupliziert', () => {
    const r = validateWorkDocumentation({
      workNotesEnabled: false,
      activeActivityCount: 2,
      projectWorkActivityIds: ['a', 'a', 'b'],
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.activityIds, ['a', 'b']);
  });
});

describe('aggregateDayWorkDocs', () => {
  it('vereinigt Labels und Freitexte', () => {
    const r = aggregateDayWorkDocs([
      { workNotes: 'A', labels: ['Kabel'], activityIds: ['1'] },
      { workNotes: 'B', labels: ['Kabel', 'Schrank'], activityIds: ['1', '2'] },
    ]);
    assert.deepEqual(r.activityIds.sort(), ['1', '2']);
    assert.ok(r.labels.includes('Kabel') && r.labels.includes('Schrank'));
    assert.equal(r.workNotes, 'A · B');
  });
});
