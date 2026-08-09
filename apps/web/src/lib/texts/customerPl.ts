/**
 * UI-Texte für Domäne `customerPl` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const customerPl = {
    nav: {
      projects: 'Meine Projekte',
      timesheets: 'Stundenzettel',
    },
    projects: {
      title: 'Meine Projekte',
      subtitle: 'Projekte, für die Sie als Kunden-Projektleiter freigeschaltet sind',
      empty:
        'Ihnen ist derzeit kein Projekt zugeordnet. Bitte wenden Sie sich ans Büro.',
      columns: {
        projectNumber: 'Nummer',
        title: 'Projekt',
        customer: 'Kunde',
        items: 'Items',
      },
      open: 'Board öffnen',
      reload: 'Aktualisieren',
      error: 'Projekte konnten nicht geladen werden.',
    },
    board: {
      title: 'Item-Board',
      backToProjects: 'Zurück zu meinen Projekten',
      search: 'Suche nach Kennung, Titel oder Raum …',
      filterStatus: 'Status',
      all: 'Alle',
      reload: 'Aktualisieren',
      countLabel: 'Items',
      reviewHint:
        'Items in Kontrolle warten auf Ihre Prüfung. Nacharbeit liegt beim Monteur.',
      empty: 'Keine Items gefunden.',
      emptyUnfiltered: 'Für dieses Projekt sind noch keine Items erfasst.',
      truncated:
        'Es werden die ersten {take} von {total} Items angezeigt – bitte filtern.',
      columns: {
        itemKey: 'Kennung',
        title: 'Titel',
        location: 'Ort',
        block: 'Block',
        status: 'Status',
        workers: 'Monteure',
        lastReport: 'Letzte Meldung',
      },
      notFound: 'Projekt nicht gefunden oder nicht freigegeben.',
    },
    detail: {
      title: 'Item',
      metadata: 'Angaben',
      floor: 'Geschoss',
      area: 'Bereich',
      room: 'Raum',
      type: 'Typ',
      rc: 'RC',
      detailField: 'Detail',
      planPage: 'Planseite',
      pdfFile: 'PDF-Datei',
      pdfPage: 'PDF-Seite',
      workScope: 'Arbeitsumfang',
      materials: 'Material',
      qty: 'Menge',
      material: 'Material',
      noMaterials: 'Kein Material erfasst.',
      assignments: 'Monteure',
      noAssignments: 'Aktuell kein Monteur zugeordnet.',
      since: 'seit',
      reports: 'Rückmeldungen',
      noReports: 'Noch keine Rückmeldung.',
      photos: 'Fotos der Fertigmeldung',
      photo: 'Foto',
      photoError: 'Foto konnte nicht geladen werden.',
      openPhoto: 'Foto öffnen',
      reviews: 'Kontrollen',
      noReviews: 'Noch keine Kontrolle.',
      reworkHint:
        'Nacharbeit bleibt beim Monteur. Sie können das Item trotzdem selbst fertigsetzen.',
    },
    actions: {
      title: 'Prüfung',
      approve: 'Geprüft / OK',
      approving: 'Wird geprüft …',
      forceComplete: 'Selbst fertigsetzen',
      comment: 'Bemerkung (optional)',
      commentPlaceholder: 'Anmerkung zur Prüfung …',
      close: 'Schließen',
      approveOnlyInReview:
        'Nur Items in Kontrolle können geprüft werden – sonst „Selbst fertigsetzen“.',
      alreadyApproved: 'Dieses Item ist bereits geprüft.',
    },
    forceCompleteDialog: {
      title: 'Item selbst fertigsetzen?',
      description:
        'Das Item wird auf „Geprüft“ gesetzt. Zugeordnete Monteure verlieren die Position sofort und laufende Item-Zeiten werden beendet.',
      confirm: 'Fertigsetzen',
    },
    toast: {
      approved: 'Item als geprüft gesetzt.',
      forceCompleted: 'Item wurde fertiggesetzt.',
      error: 'Aktion fehlgeschlagen.',
    },
    timesheets: {
      title: 'Stundenzettel',
      subtitle: 'Wochenstunden der Monteure prüfen und abzeichnen',
      empty: 'Für Ihre Projekte liegen noch keine Stundenzettel vor.',
      noResults: 'Keine Stundenzettel gefunden.',
      backToList: 'Zurück zur Übersicht',
      reload: 'Aktualisieren',
      notFound: 'Stundenzettel nicht gefunden oder nicht freigegeben.',
      onlySubmitted:
        'Abgezeichnet werden können nur eingereichte Stundenzettel (Status „Eingereicht“).',
      hint: 'Sie sehen ausschließlich Stundenzettel Ihrer freigegebenen Projekte.',
      approve: 'Abzeichnen',
      approving: 'Wird abgezeichnet …',
      approved: 'Abgezeichnet',
      approvedAt: 'Abgezeichnet am',
      signedDigitally: 'digital unterschrieben',
      signAndApprove: 'Digital unterschreiben & abzeichnen',
      signHint:
        'Am Wochenende: Unterschrift per Finger/Stift setzen – danach ist der Zettel freigegeben und im PDF sichtbar.',
      signDialogTitle: 'Stundenzettel digital abzeichnen',
      signDialogHint:
        'Bitte mit Finger oder Stift unterschreiben. Die Unterschrift erscheint auf dem Wochen-PDF.',
      downloadPdf: 'PDF herunterladen',
      toastApproved: 'Stundenzettel abgezeichnet.',
      toastSignedAndApproved:
        'Unterschrift gespeichert und Stundenzettel abgezeichnet.',
      toastError: 'Aktion fehlgeschlagen.',
      week: 'Woche',
      totals: 'Wochensumme',
    },
  } as const;
