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
    subtitle: 'Standorte bei Login, Stempel, Foto, Aktionen und im Intervall',
    empty: 'Keine GPS-Ereignisse im gewählten Zeitraum.',
    selectWorker: 'Monteur filtern',
    allWorkers: 'Alle Monteure',
    selectProject: 'Projekt filtern',
    allProjects: 'Alle Projekte',
    dateFrom: 'Von',
    dateTo: 'Bis',
    mapTitle: 'Bewegungsspur',
    mapHint:
      'Grün = Start, Blau = Zwischenpunkte, Rot = Ende – verbunden in zeitlicher Reihenfolge.',
    mapNeedWorker: 'Für die Karte bitte einen Monteur auswählen.',
    eventTypes: {
      CLOCK_IN: 'Einstempeln',
      CLOCK_OUT: 'Ausstempeln',
      MANUAL: 'Intervall',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
      PHOTO: 'Foto',
      ACTION: 'Aktion',
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
