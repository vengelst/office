/**
 * Validierung projektbezogener Arbeitsdokumentation (Clock-Out / Stundenzettel-Tag).
 */

export type WorkDocumentationInput = {
  /** Projekt-Flag: Freitext erlaubt/pflichtfähig. */
  workNotesEnabled: boolean;
  /** Anzahl aktiver Tätigkeiten am Projekt (für Konfigurationsfehler). */
  activeActivityCount: number;
  /** Gewählte Tätigkeits-IDs (müssen zum Projekt gehören – separat prüfen). */
  projectWorkActivityIds: string[];
  /** Freitext, optional. */
  workNotes?: string | null;
};

export type WorkDocumentationResult =
  | { ok: true; notes: string | null; activityIds: string[] }
  | { ok: false; message: string; statusCode: 400 };

/** Normalisiert Freitext (trim; leer → null). */
export function normalizeWorkNotes(notes?: string | null): string | null {
  if (notes == null) return null;
  const t = notes.trim();
  return t.length > 0 ? t : null;
}

/**
 * Prüft Inhaltspflicht laut Auftrag #30.
 * - Freitext an: ≥1 Checkbox ODER nicht-leerer Freitext
 * - Freitext aus: ≥1 Checkbox
 * - Keine Tätigkeiten + Freitext aus → Konfigurationsfehler
 */
export function validateWorkDocumentation(
  input: WorkDocumentationInput,
): WorkDocumentationResult {
  const activityIds = [
    ...new Set(
      (input.projectWorkActivityIds ?? []).filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      ),
    ),
  ];
  const notes = normalizeWorkNotes(input.workNotes);
  const hasCheckbox = activityIds.length > 0;
  const hasNotes = notes != null;

  if (input.activeActivityCount <= 0 && !input.workNotesEnabled) {
    return {
      ok: false,
      statusCode: 400,
      message:
        'Keine Arbeitstätigkeiten am Projekt hinterlegt und Freitext deaktiviert. Bitte im Büro Tätigkeiten am Projekt anlegen.',
    };
  }

  if (input.workNotesEnabled) {
    if (!hasCheckbox && !hasNotes) {
      return {
        ok: false,
        statusCode: 400,
        message:
          'Mindestens eine Tätigkeit und/oder Freitext erforderlich',
      };
    }
  } else if (!hasCheckbox) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Mindestens eine Tätigkeit erforderlich',
    };
  }

  if (!input.workNotesEnabled && hasNotes) {
    // Freitext aus: Notes ignorieren (nicht speichern)
    return { ok: true, notes: null, activityIds };
  }

  return { ok: true, notes, activityIds };
}

/** Vereinigt Labels und Freitexte mehrerer Schichten eines Tages. */
export function aggregateDayWorkDocs(
  entries: Array<{
    workNotes: string | null;
    labels: string[];
    activityIds: string[];
  }>,
): { workNotes: string | null; activityIds: string[]; labels: string[] } {
  const idSet = new Set<string>();
  const labelSet = new Set<string>();
  const noteParts: string[] = [];
  for (const e of entries) {
    for (const id of e.activityIds) idSet.add(id);
    for (const l of e.labels) {
      if (l.trim()) labelSet.add(l.trim());
    }
    const n = normalizeWorkNotes(e.workNotes);
    if (n) noteParts.push(n);
  }
  return {
    activityIds: [...idSet],
    labels: [...labelSet],
    workNotes: noteParts.length > 0 ? noteParts.join(' · ') : null,
  };
}
