/**
 * Monteur-Kiosk-Terminal: DE / SK / SL.
 * Setup und Kunden-PL bleiben Deutsch (Admin-/Büro-Fläche).
 */

import type { Trilingual } from '@/lib/kiosk-locale';

type FnTerm<A extends unknown[]> = (...args: A) => Trilingual;

const de = {
  pinTitle: 'PIN eingeben',
  pinHint: '6-stellige Monteur-PIN',
  pinError: 'Ungültige PIN. Bitte erneut versuchen.',
  pinChecking: 'Wird geprüft …',
  clear: 'Löschen',
  confirm: 'OK',
  notClockedIn: 'Nicht eingestempelt',
  clockedInSince: 'Eingestempelt seit',
  startWork: 'ARBEIT STARTEN',
  stopWork: 'ARBEIT BEENDEN',
  takePhoto: 'Foto aufnehmen',
  photoUploading: 'Wird hochgeladen …',
  gpsActive: 'GPS aktiv',
  gpsInactive: 'GPS nicht verfügbar',
  gpsAcquiring: 'GPS wird ermittelt …',
  autoLogout: (seconds: number) => `Automatisch zurück in ${seconds} Sek.`,
  back: 'Zurück',
  setupButton: 'Setup',
  adminPinPrompt: 'Admin-PIN eingeben',
  confirmClockIn: (name: string, time: string) =>
    `${name} – Eingestempelt um ${time}`,
  confirmClockOut: (name: string, time: string, duration: string) =>
    `${name} – Ausgestempelt um ${time} (${duration})`,
  goodDay: 'Guten Arbeitstag!',
  goodBye: 'Bis morgen!',
  upcomingProjects: 'Zukünftige Projekte',
  liveOverview: 'Heute eingestempelt',
  notOnSite: 'Noch nicht da',
  since: 'seit',
  processing: 'Wird verarbeitet …',
  error: 'Aktion fehlgeschlagen. Bitte erneut versuchen.',
  savedPending: 'Gespeichert – wird synchronisiert',
  workItems: 'Arbeitsitems',
  language: 'Sprache',
};

const sk: { [K in keyof typeof de]: (typeof de)[K] } = {
  pinTitle: 'Zadajte PIN',
  pinHint: '6-miestny PIN montéra',
  pinError: 'Neplatný PIN. Skúste znova.',
  pinChecking: 'Kontroluje sa …',
  clear: 'Vymazať',
  confirm: 'OK',
  notClockedIn: 'Nie ste zapísaný',
  clockedInSince: 'Zapísaný od',
  startWork: 'ZAČAŤ PRÁCU',
  stopWork: 'UKONČIŤ PRÁCU',
  takePhoto: 'Odfotiť',
  photoUploading: 'Nahráva sa …',
  gpsActive: 'GPS aktívne',
  gpsInactive: 'GPS nedostupné',
  gpsAcquiring: 'Zisťuje sa GPS …',
  autoLogout: (seconds: number) => `Automatický návrat o ${seconds} s`,
  back: 'Späť',
  setupButton: 'Setup',
  adminPinPrompt: 'Zadajte admin PIN',
  confirmClockIn: (name: string, time: string) =>
    `${name} – Zapísaný o ${time}`,
  confirmClockOut: (name: string, time: string, duration: string) =>
    `${name} – Odhlásený o ${time} (${duration})`,
  goodDay: 'Pekný pracovný deň!',
  goodBye: 'Dovidenia!',
  upcomingProjects: 'Budúce projekty',
  liveOverview: 'Dnes zapísaní',
  notOnSite: 'Ešte nie sú tu',
  since: 'od',
  processing: 'Spracováva sa …',
  error: 'Akcia zlyhala. Skúste znova.',
  savedPending: 'Uložené – synchronizuje sa',
  workItems: 'Pracovné položky',
  language: 'Jazyk',
};

const sl: { [K in keyof typeof de]: (typeof de)[K] } = {
  pinTitle: 'Vnesite PIN',
  pinHint: '6-mestni PIN monterja',
  pinError: 'Neveljaven PIN. Poskusite znova.',
  pinChecking: 'Preverjanje …',
  clear: 'Izbriši',
  confirm: 'OK',
  notClockedIn: 'Niste prijavljeni',
  clockedInSince: 'Prijavljeni od',
  startWork: 'ZAČNI DELO',
  stopWork: 'KONČAJ DELO',
  takePhoto: 'Posnemi fotografijo',
  photoUploading: 'Nalaganje …',
  gpsActive: 'GPS aktiven',
  gpsInactive: 'GPS ni na voljo',
  gpsAcquiring: 'Določanje GPS …',
  autoLogout: (seconds: number) => `Samodejna vrnitev čez ${seconds} s`,
  back: 'Nazaj',
  setupButton: 'Setup',
  adminPinPrompt: 'Vnesite admin PIN',
  confirmClockIn: (name: string, time: string) =>
    `${name} – Prijavljeni ob ${time}`,
  confirmClockOut: (name: string, time: string, duration: string) =>
    `${name} – Odjavljeni ob ${time} (${duration})`,
  goodDay: 'Lep delovni dan!',
  goodBye: 'Nasvidenje!',
  upcomingProjects: 'Prihodnji projekti',
  liveOverview: 'Danes prijavljeni',
  notOnSite: 'Še niso tukaj',
  since: 'od',
  processing: 'Obdelava …',
  error: 'Dejanje ni uspelo. Poskusite znova.',
  savedPending: 'Shranjeno – sinhronizacija',
  workItems: 'Delovne postavke',
  language: 'Jezik',
};

type TerminalI18n = {
  [K in keyof typeof de]: (typeof de)[K] extends (...args: infer A) => string
    ? FnTerm<A extends unknown[] ? A : never>
    : Trilingual;
};

function build(): TerminalI18n {
  const keys = Object.keys(de) as (keyof typeof de)[];
  const out = {} as TerminalI18n;
  for (const key of keys) {
    const d = de[key];
    const s = sk[key];
    const l = sl[key];
    if (typeof d === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = (...args: any[]) => ({
        de: (d as (...a: unknown[]) => string)(...args),
        sk: (s as (...a: unknown[]) => string)(...args),
        sl: (l as (...a: unknown[]) => string)(...args),
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = { de: d, sk: s, sl: l };
    }
  }
  return out;
}

export const KT = build();
