/**
 * UI-Texte für Domäne `workerApp` (DE-Labels der Office-Web-App).
 * Nur String-Konstanten – absichtlich ohne Kommentar je Key.
 */

export const workerApp = {
    title: 'Zeiterfassung',
    pin: {
      title: 'Monteur-Anmeldung',
      subtitle: 'PIN eingeben',
      clear: 'Löschen',
      backspace: 'Zurück',
      submit: 'Anmelden',
      submitting: 'Wird geprüft …',
      error: 'Falsche PIN. Bitte erneut versuchen.',
      hint: 'PIN eingeben',
    },
    dashboard: {
      greeting: 'Hallo',
      currentProject: 'Aktuelles Projekt',
      noProject: 'Kein aktives Projekt zugewiesen.',
      upcomingProjects: 'Zukünftige Projekte',
      clockedInSince: 'Eingestempelt seit',
      notClockedIn: 'Nicht eingestempelt',
      start: 'Arbeit starten',
      stop: 'Arbeit beenden',
      working: 'Wird verarbeitet …',
      todayTitle: 'Heutige Zeiten',
      todayEmpty: 'Heute noch keine Stempelungen.',
      clockIn: 'Ein',
      clockOut: 'Aus',
      startBreak: 'Pause starten',
      endBreak: 'Pause beenden',
      onBreakSince: 'Pause seit',
      gpsActive: 'GPS aktiv',
      gpsInactive: 'GPS inaktiv',
      addPhoto: 'Arbeitsfoto hinzufügen',
      photoComment: 'Kommentar (optional)',
      photoCommentHint:
        'Text eingeben. Optional „Ins Bild setzen“ und Stelle im Foto tippen.',
      photoPlace: 'Ins Bild setzen',
      photoPlaceHint: 'Jetzt auf die Stelle im Foto tippen …',
      photoPlaceDone: 'Tippen …',
      photoClearPlace: 'Position zurücksetzen',
      photoUpload: 'Hochladen',
      photoUploading: 'Wird hochgeladen …',
      photoCancel: 'Abbrechen',
      photoSkip: 'Ohne Kommentar',
      logout: 'Abmelden',
      chooseActivity: 'Tätigkeit wählen',
      switchActivity: 'Tätigkeit wechseln',
      currentActivity: 'Aktuelle Tätigkeit',
      workDocTitle: 'Arbeiten dokumentieren',
      workDocDescription:
        'Bitte die erledigten Arbeiten dieser Schicht angeben.',
      workDocSave: 'Speichern',
      workDocNotes: 'Freitext',
      workDocNotesPlaceholder: 'Weitere Angaben …',
      workDocEmpty:
        'Keine Tätigkeiten am Projekt – Freitext verwenden oder Büro informieren.',
      workDocConfigError:
        'Keine Arbeitstätigkeiten am Projekt und Freitext aus. Bitte Büro kontaktieren.',
      workDocValidation:
        'Mindestens eine Tätigkeit und/oder Freitext erforderlich.',
    },
    toast: {
      clockedIn: 'Eingestempelt.',
      clockedOut: 'Ausgestempelt.',
      breakStarted: 'Pause gestartet.',
      breakEnded: 'Pause beendet.',
      photoUploaded: 'Foto hochgeladen.',
      error: 'Aktion fehlgeschlagen.',
      noProject: 'Bitte zuerst ein Projekt auswählen.',
      noActivity: 'Bitte Tätigkeit wählen.',
      activitySwitched: 'Tätigkeit gewechselt.',
      savedPending: 'Gespeichert – wird synchronisiert',
      workDocumented: 'Arbeiten gespeichert.',
    },
  } as const;
