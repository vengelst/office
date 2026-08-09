/** UI-Texte: `dashboard`. */
export const dashboard = {
    title: 'Dashboard',
    welcome: 'Willkommen zurück',
    cards: {
      customers: 'Aktive Kunden',
      projects: 'Laufende Projekte',
      workers: 'Aktive Monteure',
      hours: 'Stunden diese Woche',
    },
    placeholder: 'Kennzahlen folgen in einem späteren Auftrag.',
    clockedIn: {
      title: 'Heute eingestempelt',
      subtitle: 'Aktuell eingestempelte Monteure · zur Live-Übersicht',
    },
    workers: {
      title: 'Monteur-Verfügbarkeit',
      available: 'Verfügbar',
      onProject: 'Im Einsatz',
      absent: 'Krank / Urlaub',
      expiringTitle: 'Ablaufende Dokumente',
      expiringWarning: (n: number): string =>
        n === 1
          ? '1 Monteur hat ein bald ablaufendes Dokument.'
          : `${n} Monteure haben bald ablaufende Dokumente.`,
      expiringNone: 'Keine ablaufenden Dokumente.',
      viewAll: 'Alle Monteure →',
    },
    invoices: {
      openTitle: 'Offene Ausgangsrechnungen',
      openSubtitle: 'Noch nicht beglichen · zu den Rechnungen',
      overdueTitle: 'Überfällige Rechnungen',
      overdueWarning: (n: number): string =>
        n === 1
          ? '1 Rechnung ist überfällig.'
          : `${n} Rechnungen sind überfällig.`,
      overdueNone: 'Keine überfälligen Rechnungen.',
      count: (n: number): string => (n === 1 ? '1 offen' : `${n} offen`),
    },
    vehicles: {
      title: 'Fahrzeuge',
      total: 'Gesamt',
      assigned: 'Zugewiesen',
      expiringTitle: 'TÜV/Versicherung',
      expiringWarning: (n: number): string =>
        n === 1
          ? '1 Fahrzeug mit ablaufender Frist.'
          : `${n} Fahrzeuge mit ablaufenden Fristen.`,
      expiringNone: 'Alle Fristen aktuell.',
      viewAll: 'Alle Fahrzeuge →',
    },
  } as const;
