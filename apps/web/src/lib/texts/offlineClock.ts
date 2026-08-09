/** Offline-Stempeln Banner (Auftrag #13) – Worker-App + Kiosk */
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
