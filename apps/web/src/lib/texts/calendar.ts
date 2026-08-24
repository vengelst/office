/**
 * UI-Texte für Domäne `calendar` (DE-Labels der Office-Web-App).
 */

export const calendar = {
  title: 'Termine',
  subtitle: 'Büro-Termine verwalten und optional nach Google Calendar synchronisieren',
  new: 'Neuer Termin',
  edit: 'Termin bearbeiten',
  empty: 'Keine Termine im gewählten Zeitraum',
  fields: {
    title: 'Titel',
    description: 'Beschreibung',
    location: 'Ort',
    startAt: 'Beginn',
    endAt: 'Ende',
    allDay: 'Ganztägig',
    project: 'Projekt (optional)',
    syncToGoogle: 'Nach Google Calendar synchronisieren',
    noProject: 'Kein Projekt',
  },
  filter: {
    from: 'Von',
    to: 'Bis',
  },
  synced: 'In Google Calendar',
  notSynced: 'Nur lokal',
  toast: {
    created: 'Termin erstellt',
    updated: 'Termin aktualisiert',
    deleted: 'Termin gelöscht',
    error: 'Aktion fehlgeschlagen',
  },
  deleteConfirm: 'Diesen Termin wirklich löschen?',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
} as const;
