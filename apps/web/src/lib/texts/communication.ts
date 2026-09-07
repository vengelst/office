/**
 * UI-Texte für Domäne `communication` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const communication = {
    title: 'Kommunikation',
    subtitle: 'Telefonate, Notizen und Nachrichten – gesamt und nach Kontakt',
    nav: 'Kommunikation',
    newEntry: 'Neuer Eintrag',
    quickCall: 'Schnelles Telefonat',
    editEntry: 'Eintrag bearbeiten',
    overview: 'Übersicht',
    phoneCallsOfContact: 'Telefonate',
    type: {
      PHONE_CALL: 'Telefonat',
      EMAIL: 'E-Mail',
      MEETING: 'Besprechung',
      NOTE: 'Notiz',
      INSTRUCTION: 'Anweisung',
      WHATSAPP: 'WhatsApp',
    },
    direction: {
      INCOMING: 'Eingehend',
      OUTGOING: 'Ausgehend',
    },
    entityType: {
      CUSTOMER: 'Kunde',
      SUBCONTRACTOR: 'Subunternehmer',
      WORKER: 'Monteur',
    },
    fields: {
      type: 'Art',
      direction: 'Richtung',
      contact: 'Kontaktperson',
      subject: 'Betreff',
      content: 'Inhalt',
      occurredAt: 'Datum/Uhrzeit',
      duration: 'Dauer (Minuten)',
      entity: 'Bezug',
      author: 'Autor',
      from: 'Von',
      to: 'Bis',
    },
    filter: {
      all: 'Alle',
      byType: 'Nach Art filtern',
      byContact: 'Nach Kontaktperson',
      byEntityType: 'Nach Entität',
      byAuthor: 'Nach Autor',
      byPeriod: 'Zeitraum',
    },
    actions: {
      createTodo: 'To-Do anlegen',
      createEvent: 'Termin anlegen',
      openEntity: 'Stammdatensatz öffnen',
      more: 'Aktionen',
    },
    todoDialog: {
      title: 'To-Do aus Kommunikation',
      save: 'To-Do speichern',
    },
    eventDialog: {
      title: 'Termin aus Kommunikation',
      save: 'Termin speichern',
    },
    empty: 'Keine Kommunikationseinträge vorhanden',
    emptyFiltered: 'Keine Einträge für die aktuellen Filter',
    toast: {
      created: 'Eintrag erstellt',
      updated: 'Eintrag aktualisiert',
      deleted: 'Eintrag gelöscht',
      todoCreated: 'To-Do angelegt',
      eventCreated: 'Termin angelegt',
      error: 'Aktion fehlgeschlagen',
    },
    dictation: {
      start: 'Diktat starten',
      stop: 'Diktat beenden',
      notSupported: 'Spracheingabe wird von diesem Browser nicht unterstützt',
      listening: 'Aufnahme läuft...',
    },
    deleteConfirm: 'Diesen Eintrag wirklich löschen?',
    whatsappHint: 'Manuelle Notiz – kein WhatsApp-Sync',
  } as const;
