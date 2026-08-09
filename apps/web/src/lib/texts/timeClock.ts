/**
 * UI-Texte für Domäne `timeClock` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const timeClock = {
    title: 'Stempeluhr',
    subtitle: 'Wer ist gerade eingestempelt?',
    refresh: 'Aktualisieren',
    liveCount: (n: number): string =>
      n === 1 ? '1 Monteur eingestempelt' : `${n} Monteure eingestempelt`,
    empty: 'Aktuell ist niemand eingestempelt.',
    columns: {
      worker: 'Monteur',
      project: 'Projekt',
      customer: 'Kunde',
      since: 'Eingestempelt seit',
      duration: 'Dauer',
    },
    openWorkerApp: 'Monteur-App öffnen',
  } as const;
