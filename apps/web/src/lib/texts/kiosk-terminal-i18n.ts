/**
 * Monteur-Kiosk-Terminal: DE / SK / SL.
 * Setup und Kunden-PL bleiben Deutsch (Admin-/Büro-Fläche).
 */

import type { Trilingual } from '@/lib/kiosk-locale';

export const KT = {
  pinTitle: {
    de: 'PIN eingeben',
    sk: 'Zadajte PIN',
    sl: 'Vnesite PIN',
  },
  pinHint: {
    de: '6-stellige Monteur-PIN',
    sk: '6-miestny PIN montéra',
    sl: '6-mestni PIN monterja',
  },
  pinError: {
    de: 'Ungültige PIN. Bitte erneut versuchen.',
    sk: 'Neplatný PIN. Skúste znova.',
    sl: 'Neveljaven PIN. Poskusite znova.',
  },
  pinChecking: {
    de: 'Wird geprüft …',
    sk: 'Kontroluje sa …',
    sl: 'Preverjanje …',
  },
  clear: { de: 'Löschen', sk: 'Vymazať', sl: 'Izbriši' },
  confirm: { de: 'OK', sk: 'OK', sl: 'OK' },
  notClockedIn: {
    de: 'Nicht eingestempelt',
    sk: 'Nie ste zapísaný',
    sl: 'Niste prijavljeni',
  },
  clockedInSince: {
    de: 'Eingestempelt seit',
    sk: 'Zapísaný od',
    sl: 'Prijavljeni od',
  },
  startWork: {
    de: 'ARBEIT STARTEN',
    sk: 'ZAČAŤ PRÁCU',
    sl: 'ZAČNI DELO',
  },
  stopWork: {
    de: 'ARBEIT BEENDEN',
    sk: 'UKONČIŤ PRÁCU',
    sl: 'KONČAJ DELO',
  },
  takePhoto: {
    de: 'Foto aufnehmen',
    sk: 'Odfotiť',
    sl: 'Posnemi fotografijo',
  },
  photoUploading: {
    de: 'Wird hochgeladen …',
    sk: 'Nahráva sa …',
    sl: 'Nalaganje …',
  },
  gpsActive: { de: 'GPS aktiv', sk: 'GPS aktívne', sl: 'GPS aktiven' },
  gpsInactive: {
    de: 'GPS nicht verfügbar',
    sk: 'GPS nedostupné',
    sl: 'GPS ni na voljo',
  },
  gpsAcquiring: {
    de: 'GPS wird ermittelt …',
    sk: 'Zisťuje sa GPS …',
    sl: 'Določanje GPS …',
  },
  autoLogout: (seconds: number): Trilingual => ({
    de: `Automatisch zurück in ${seconds} Sek.`,
    sk: `Automatický návrat o ${seconds} s`,
    sl: `Samodejna vrnitev čez ${seconds} s`,
  }),
  back: { de: 'Zurück', sk: 'Späť', sl: 'Nazaj' },
  setupButton: { de: 'Setup', sk: 'Setup', sl: 'Setup' },
  adminPinPrompt: {
    de: 'Admin-PIN eingeben',
    sk: 'Zadajte admin PIN',
    sl: 'Vnesite admin PIN',
  },
  confirmClockIn: (name: string, time: string): Trilingual => ({
    de: `${name} – Eingestempelt um ${time}`,
    sk: `${name} – Zapísaný o ${time}`,
    sl: `${name} – Prijavljeni ob ${time}`,
  }),
  confirmClockOut: (
    name: string,
    time: string,
    duration: string,
  ): Trilingual => ({
    de: `${name} – Ausgestempelt um ${time} (${duration})`,
    sk: `${name} – Odhlásený o ${time} (${duration})`,
    sl: `${name} – Odjavljeni ob ${time} (${duration})`,
  }),
  goodDay: {
    de: 'Guten Arbeitstag!',
    sk: 'Pekný pracovný deň!',
    sl: 'Lep delovni dan!',
  },
  goodBye: { de: 'Bis morgen!', sk: 'Dovidenia!', sl: 'Nasvidenje!' },
  upcomingProjects: {
    de: 'Zukünftige Projekte',
    sk: 'Budúce projekty',
    sl: 'Prihodnji projekti',
  },
  liveOverview: {
    de: 'Heute eingestempelt',
    sk: 'Dnes zapísaní',
    sl: 'Danes prijavljeni',
  },
  notOnSite: {
    de: 'Noch nicht da',
    sk: 'Ešte nie sú tu',
    sl: 'Še niso tukaj',
  },
  since: { de: 'seit', sk: 'od', sl: 'od' },
  processing: {
    de: 'Wird verarbeitet …',
    sk: 'Spracováva sa …',
    sl: 'Obdelava …',
  },
  error: {
    de: 'Aktion fehlgeschlagen. Bitte erneut versuchen.',
    sk: 'Akcia zlyhala. Skúste znova.',
    sl: 'Dejanje ni uspelo. Poskusite znova.',
  },
  savedPending: {
    de: 'Gespeichert – wird synchronisiert',
    sk: 'Uložené – synchronizuje sa',
    sl: 'Shranjeno – sinhronizacija',
  },
  workItems: {
    de: 'Arbeitsitems',
    sk: 'Pracovné položky',
    sl: 'Delovne postavke',
  },
  language: { de: 'Sprache', sk: 'Jazyk', sl: 'Jezik' },
  noAssignment: {
    de: 'Keine gültige Zuweisung für dieses Projekt',
    sk: 'Žiadne platné priradenie k tomuto projektu',
    sl: 'Ni veljavne dodelitve za ta projekt',
  },
  photoCommentTitle: {
    de: 'Kommentar zum Foto',
    sk: 'Komentár k fotografii',
    sl: 'Komentar k fotografiji',
  },
  photoCommentHint: {
    de: 'z. B. Positionsnummer – erscheint im Bild',
    sk: 'napr. číslo pozície – zobrazí sa na fotke',
    sl: 'npr. številka pozicije – prikaže se na fotografiji',
  },
  photoCommentSave: {
    de: 'Foto speichern',
    sk: 'Uložiť foto',
    sl: 'Shrani fotografijo',
  },
  photoCommentSkip: {
    de: 'Ohne Kommentar',
    sk: 'Bez komentára',
    sl: 'Brez komentarja',
  },
} as const;
