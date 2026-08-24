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
  tabs: {
    live: 'Live',
    gps: 'GPS-Daten',
  },
  gps: {
    title: 'GPS-Daten',
    subtitle: 'Aufgezeichnete Standorte beim Ein- und Ausstempeln',
    empty: 'Keine GPS-Ereignisse im gewählten Zeitraum.',
    eventTypes: {
      CLOCK_IN: 'Einstempeln',
      CLOCK_OUT: 'Ausstempeln',
      MANUAL: 'Manuell',
    },
    columns: {
      time: 'Zeit',
      worker: 'Monteur',
      project: 'Projekt',
      event: 'Ereignis',
      location: 'Standort',
      accuracy: 'Genauigkeit',
    },
    openMap: 'Karte öffnen',
    daysBack: 'Letzte Tage',
  },
  columns: {
    worker: 'Monteur',
    project: 'Projekt',
    customer: 'Kunde',
    since: 'Eingestempelt seit',
    duration: 'Dauer',
  },
  openWorkerApp: 'Monteur-App öffnen',
} as const;
