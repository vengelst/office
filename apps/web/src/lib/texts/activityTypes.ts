/**
 * UI-Texte für Domäne `activityTypes` (Master-Tätigkeitsbereiche).
 */

export const activityTypes = {
  title: 'Tätigkeitsbereiche',
  subtitle: 'Katalog für Master-Monteure (abrechnungsrelevant)',
  newItem: 'Neuer Tätigkeitsbereich',
  editItem: 'Tätigkeitsbereich bearbeiten',
  empty: 'Noch keine Tätigkeitsbereiche vorhanden.',
  columns: {
    code: 'Code',
    name: 'Name',
    sortOrder: 'Reihenfolge',
    active: 'Aktiv',
    billable: 'Abrechenbar',
  },
  fields: {
    code: 'Code',
    name: 'Bezeichnung',
    sortOrder: 'Sortierung',
    active: 'Aktiv',
    billable: 'Abrechnungsrelevant',
  },
  actions: {
    create: 'Anlegen',
    save: 'Speichern',
    delete: 'Deaktivieren',
    cancel: 'Abbrechen',
  },
  toast: {
    created: 'Tätigkeitsbereich angelegt.',
    updated: 'Tätigkeitsbereich gespeichert.',
    deleted: 'Tätigkeitsbereich deaktiviert.',
    error: 'Aktion fehlgeschlagen.',
  },
  deleteTitle: 'Tätigkeitsbereich deaktivieren?',
  deleteConfirm:
    'Der Eintrag wird deaktiviert (bestehende Stempelungen bleiben erhalten).',
};
