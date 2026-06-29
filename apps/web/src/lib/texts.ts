/**
 * Zentrale UI-Texte (Vorbereitung i18n).
 * Keine hartcodierten Strings in Komponenten – alles hier referenzieren.
 */
export const texts = {
  app: {
    name: 'Office',
    tagline: 'CRM · Projekte · Monteure · Zeiterfassung',
  },
  nav: {
    dashboard: 'Dashboard',
    customers: 'Kunden',
    projects: 'Projekte',
    workers: 'Monteure',
    timesheets: 'Stundenzettel',
    settings: 'Einstellungen',
  },
  login: {
    title: 'Anmelden',
    subtitle: 'Melde dich mit deinen Zugangsdaten an.',
    email: 'E-Mail',
    emailPlaceholder: 'name@office.local',
    password: 'Passwort',
    passwordPlaceholder: '••••••••',
    submit: 'Anmelden',
    submitting: 'Wird angemeldet …',
    errorTitle: 'Anmeldung fehlgeschlagen',
    errorGeneric: 'E-Mail oder Passwort ist ungültig.',
  },
  header: {
    toggleTheme: 'Design wechseln',
    logout: 'Abmelden',
    openMenu: 'Menü öffnen',
    account: 'Konto',
  },
  dashboard: {
    title: 'Dashboard',
    welcome: 'Willkommen zurück',
    cards: {
      customers: 'Aktive Kunden',
      projects: 'Laufende Projekte',
      workers: 'Aktive Monteure',
      hours: 'Stunden diese Woche',
    },
    placeholder: 'Kennzahlen folgen in einem späteren Auftrag.',
  },
  customers: {
    title: 'Kunden',
    placeholder: 'Die Kundenverwaltung folgt in Auftrag #2.',
  },
  projects: {
    title: 'Projekte',
    placeholder: 'Die Projektverwaltung folgt in Auftrag #2.',
  },
  workers: {
    title: 'Monteure',
    placeholder: 'Die Monteurverwaltung folgt in Auftrag #2.',
  },
  timesheets: {
    title: 'Stundenzettel',
    placeholder: 'Wochen-Stundenzettel folgen in einem späteren Auftrag.',
  },
  settings: {
    title: 'Einstellungen',
    placeholder: 'Einstellungen folgen in einem späteren Auftrag.',
  },
  common: {
    loading: 'Wird geladen …',
    empty: 'Keine Daten vorhanden.',
  },
} as const;

export type Texts = typeof texts;
