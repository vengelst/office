/**
 * UI-Texte für Domäne `calendar` (DE-Labels der Office-Web-App).
 */

export const calendar = {
  title: 'Kalender',
  subtitle: 'Termine anlegen und mit Google Calendar synchronisieren',
  newEvent: 'Neuer Termin',
  editEvent: 'Termin bearbeiten',
  empty: 'Keine Termine in diesem Zeitraum.',
  loading: 'Termine werden geladen …',
  month: 'Monat',
  week: 'Woche',
  list: 'Liste',
  today: 'Heute',
  prev: 'Zurück',
  next: 'Weiter',
  fields: {
    title: 'Titel',
    description: 'Beschreibung',
    startsAt: 'Beginn',
    endsAt: 'Ende',
    allDay: 'Ganztägig',
    project: 'Projekt (optional)',
    customer: 'Kunde (optional)',
    syncToGoogle: 'Mit Google Calendar synchronisieren',
    none: '— keins —',
  },
  save: 'Speichern',
  saving: 'Wird gespeichert …',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  deleteConfirm: 'Termin wirklich löschen?',
  synced: 'Mit Google verknüpft',
  notSynced: 'Nicht synchronisiert',
  toast: {
    created: 'Termin angelegt.',
    updated: 'Termin gespeichert.',
    deleted: 'Termin gelöscht.',
    error: 'Aktion fehlgeschlagen.',
  },
} as const;
