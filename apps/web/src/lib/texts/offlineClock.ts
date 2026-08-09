/**
 * UI-Texte für Domäne `offlineClock` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const offlineClock = {
    offline: 'Offline',
    pending: (n: number): string =>
      n === 1
        ? '1 Stempelung ausstehend'
        : `${n} Stempelungen ausstehend`,
    failed: (detail?: string): string =>
      detail
        ? `Sync-Fehler: ${detail}`
        : 'Sync-Fehler bei Stempelung',
    retry: 'Erneut versuchen',
    retrying: 'Wird versucht …',
    needsReauth: 'Bitte erneut anmelden – Stempelungen warten',
  } as const;
