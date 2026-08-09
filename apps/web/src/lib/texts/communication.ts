/**
 * UI-Texte für Domäne `communication` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const communication = {
    title: 'Kommunikation',
    newEntry: 'Neuer Eintrag',
    editEntry: 'Eintrag bearbeiten',
    type: {
      PHONE_CALL: 'Telefonat',
      EMAIL: 'E-Mail',
      MEETING: 'Besprechung',
      NOTE: 'Notiz',
      INSTRUCTION: 'Anweisung',
    },
    direction: {
      INCOMING: 'Eingehend',
      OUTGOING: 'Ausgehend',
    },
    fields: {
      type: 'Art',
      direction: 'Richtung',
      contact: 'Kontaktperson',
      subject: 'Betreff',
      content: 'Inhalt',
      occurredAt: 'Datum/Uhrzeit',
      duration: 'Dauer (Minuten)',
    },
    filter: {
      all: 'Alle',
      byType: 'Nach Art filtern',
      byContact: 'Nach Kontaktperson',
    },
    empty: 'Keine Kommunikationseinträge vorhanden',
    toast: {
      created: 'Eintrag erstellt',
      updated: 'Eintrag aktualisiert',
      deleted: 'Eintrag gelöscht',
    },
    dictation: {
      start: 'Diktat starten',
      stop: 'Diktat beenden',
      notSupported: 'Spracheingabe wird von diesem Browser nicht unterstützt',
      listening: 'Aufnahme läuft...',
    },
    deleteConfirm: 'Diesen Eintrag wirklich löschen?',
  } as const;
