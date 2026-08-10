/**
 * Work-Item-Texte: DE / SK / SL.
 * Außerhalb des Kiosks (worker-app): weiter „DE / SK“ in einer Zeile.
 * Im Kiosk: eine Sprache laut `useKioskLocale`.
 */

'use client';

import { useCallback } from 'react';
import type { KioskLang, Trilingual } from '@/lib/kiosk-locale';
import { useOptionalKioskLocale } from '@/lib/kiosk-locale';
import type { WorkItemPdfFailure, WorkItemStatus } from './worker-work-items';

/** @deprecated Alias – gleiche Form wie Trilingual. */
export type Bilingual = Trilingual;

/**
 * „Deutsch / Slovensky“ als eine Zeile (ohne SL – für /worker-app).
 */
export function both(term: Pick<Trilingual, 'de' | 'sk'>): string {
  return `${term.de} / ${term.sk}`;
}

export function pickLang(term: Trilingual, lang: KioskLang): string {
  return term[lang];
}

/**
 * Label-Helfer: im Kiosk eine Sprache, sonst DE/SK dual.
 */
export function useWorkItemText() {
  const kiosk = useOptionalKioskLocale();
  return useCallback(
    (term: Trilingual) =>
      kiosk ? pickLang(term, kiosk.lang) : both(term),
    [kiosk],
  );
}

// ── Status ─────────────────────────────────────────────────────

export const STATUS_LABELS: Record<WorkItemStatus, Trilingual> = {
  OPEN: { de: 'Offen', sk: 'Otvorené', sl: 'Odprto' },
  IN_PROGRESS: { de: 'In Arbeit', sk: 'Prebieha', sl: 'V teku' },
  REVIEW: { de: 'Kontrolle', sk: 'Kontrola', sl: 'Kontrola' },
  REWORK: { de: 'Nacharbeit', sk: 'Dodatočná práca', sl: 'Dodatno delo' },
  APPROVED: { de: 'Geprüft', sk: 'Schválené', sl: 'Odobreno' },
};

export function statusLabel(status: WorkItemStatus): string {
  return both(STATUS_LABELS[status]);
}

export const STATUS_COLORS: Record<
  WorkItemStatus,
  { bg: string; text: string }
> = {
  OPEN: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1' },
  IN_PROGRESS: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  REVIEW: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15' },
  REWORK: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
  APPROVED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
};

// ── Texte ──────────────────────────────────────────────────────

export const T = {
  workItems: {
    de: 'Arbeitsitems',
    sk: 'Pracovné položky',
    sl: 'Delovne postavke',
  },
  myItems: { de: 'Meine Items', sk: 'Moje položky', sl: 'Moje postavke' },
  openPool: { de: 'Offen', sk: 'Otvorené', sl: 'Odprto' },
  currentItem: {
    de: 'Aktuelles Item',
    sk: 'Aktuálna položka',
    sl: 'Trenutna postavka',
  },

  searchKey: {
    de: 'Kennung suchen',
    sk: 'Hľadať označenie',
    sl: 'Išči oznako',
  },
  noItems: { de: 'Keine Items', sk: 'Žiadne položky', sl: 'Ni postavk' },
  noOpenItems: {
    de: 'Kein offenes Item',
    sk: 'Žiadna otvorená položka',
    sl: 'Ni odprte postavke',
  },

  workScope: { de: 'Arbeitsumfang', sk: 'Rozsah prác', sl: 'Obseg del' },
  material: { de: 'Material', sk: 'Materiál', sl: 'Material' },
  floor: { de: 'Geschoss', sk: 'Poschodie', sl: 'Nadstropje' },
  area: { de: 'Bereich', sk: 'Oblasť', sl: 'Območje' },
  room: { de: 'Raum', sk: 'Miestnosť', sl: 'Prostor' },
  type: { de: 'Typ', sk: 'Typ', sl: 'Tip' },
  rc: { de: 'RC', sk: 'RC', sl: 'RC' },
  block: { de: 'Block', sk: 'Blok', sl: 'Blok' },
  plan: { de: 'Plan', sk: 'Plán', sl: 'Načrt' },
  page: { de: 'Seite', sk: 'Strana', sl: 'Stran' },
  reports: { de: 'Rückmeldungen', sk: 'Hlásenia', sl: 'Poročila' },
  photos: { de: 'Fotos', sk: 'Fotky', sl: 'Fotografije' },
  reviews: { de: 'Kontrollen', sk: 'Kontroly', sl: 'Kontrole' },
  approvedReview: {
    de: 'Kontrolle bestanden',
    sk: 'Kontrola úspešná',
    sl: 'Kontrola uspešna',
  },
  forcedReview: {
    de: 'Vom PL fertig gesetzt',
    sk: 'Ukončené vedúcim',
    sl: 'Zaključeno s strani PL',
  },
  byWorker: { de: 'von', sk: 'od', sl: 'od' },

  claim: { de: 'Nehmen', sk: 'Prevziať', sl: 'Prevzemi' },
  setCurrent: {
    de: 'Als aktuell setzen',
    sk: 'Nastaviť ako aktuálne',
    sl: 'Nastavi kot trenutno',
  },
  isCurrent: { de: 'Aktuell', sk: 'Aktuálne', sl: 'Trenutno' },
  stopTime: { de: 'Zeit stoppen', sk: 'Zastaviť čas', sl: 'Ustavi čas' },
  complete: { de: 'Fertig', sk: 'Hotovo', sl: 'Končano' },
  rework: { de: 'Nacharbeit', sk: 'Dodatočná práca', sl: 'Dodatno delo' },
  openPdf: { de: 'Plan / PDF', sk: 'Plán / PDF', sl: 'Načrt / PDF' },
  openingPdf: {
    de: 'PDF wird geladen…',
    sk: 'PDF sa načítava…',
    sl: 'Nalaganje PDF…',
  },
  camera: { de: 'Kamera', sk: 'Fotoaparát', sl: 'Kamera' },
  gallery: { de: 'Galerie', sk: 'Galéria', sl: 'Galerija' },
  send: { de: 'Senden', sk: 'Odoslať', sl: 'Pošlji' },
  cancel: { de: 'Abbrechen', sk: 'Zrušiť', sl: 'Prekliči' },
  commentOptional: {
    de: 'Bemerkung (optional)',
    sk: 'Poznámka (nepovinné)',
    sl: 'Opomba (neobvezno)',
  },

  clockInFirst: {
    de: 'Erst einstempeln',
    sk: 'Najprv sa zapíš do práce',
    sl: 'Najprej se prijavi',
  },
  clockInFirstHint: {
    de: 'Die Item-Zeit läuft nur, wenn du am Projekt eingestempelt bist.',
    sk: 'Čas položky beží iba vtedy, keď si zapísaný na projekte.',
    sl: 'Čas postavke teče le, ko ste prijavljeni na projektu.',
  },
  waitingForReview: {
    de: 'Wartet auf Kontrolle',
    sk: 'Čaká na kontrolu',
    sl: 'Čaka na kontrolo',
  },
  approvedHint: {
    de: 'Geprüft – abgeschlossen',
    sk: 'Schválené – ukončené',
    sl: 'Odobreno – zaključeno',
  },
  minPhotos: {
    de: 'Mindestens 2 Fotos (besser 2–3)',
    sk: 'Minimálne 2 fotky (lepšie 2–3)',
    sl: 'Vsaj 2 fotografiji (bolje 2–3)',
  },
  minPhotosMissing: {
    de: 'Bitte mindestens 2 Fotos aufnehmen.',
    sk: 'Nasnímaj prosím aspoň 2 fotky.',
    sl: 'Posnemite vsaj 2 fotografiji.',
  },
  claimFirst: {
    de: 'Item zuerst nehmen',
    sk: 'Najprv prevziať položku',
    sl: 'Najprej prevzemite postavko',
  },
  cameraPermission: {
    de: 'Kamera-Zugriff wird benötigt.',
    sk: 'Potrebný prístup k fotoaparátu.',
    sl: 'Potreben je dostop do kamere.',
  },
  galleryPermission: {
    de: 'Zugriff auf Fotos wird benötigt.',
    sk: 'Potrebný prístup k fotkám.',
    sl: 'Potreben je dostop do fotografij.',
  },
  timeRunning: { de: 'Zeit läuft', sk: 'Čas beží', sl: 'Čas teče' },

  error: { de: 'Fehler', sk: 'Chyba', sl: 'Napaka' },
  hint: { de: 'Hinweis', sk: 'Upozornenie', sl: 'Obvestilo' },
  done: { de: 'Erledigt', sk: 'Hotovo', sl: 'Opravljeno' },
  completeSent: {
    de: 'Fertigmeldung gesendet – wartet auf Kontrolle.',
    sk: 'Hlásenie odoslané – čaká na kontrolu.',
    sl: 'Poročilo poslano – čaka na kontrolo.',
  },
  reworkSent: {
    de: 'Nacharbeit gemeldet – Item bleibt bei dir.',
    sk: 'Nahlásená dodatočná práca – položka ostáva u teba.',
    sl: 'Prijavljeno dodatno delo – postavka ostane pri vas.',
  },
  claimed: {
    de: 'Item genommen.',
    sk: 'Položka prevzatá.',
    sl: 'Postavka prevzeta.',
  },
  loadFailed: {
    de: 'Daten konnten nicht geladen werden.',
    sk: 'Údaje sa nepodarilo načítať.',
    sl: 'Podatkov ni bilo mogoče naložiti.',
  },
  openItemsStay: {
    de: 'Offene Items bleiben dir zugeordnet.',
    sk: 'Otvorené položky ostávajú priradené tebe.',
    sl: 'Odprte postavke ostanejo dodeljene vam.',
  },

  back: { de: 'Zurück', sk: 'Späť', sl: 'Nazaj' },
  close: { de: 'Schließen', sk: 'Zavrieť', sl: 'Zapri' },
  openInNewTab: {
    de: 'In neuem Tab öffnen',
    sk: 'Otvoriť na novej karte',
    sl: 'Odpri v novem zavihku',
  },
  loading: { de: 'Lädt…', sk: 'Načítava…', sl: 'Nalaganje…' },
  refresh: { de: 'Aktualisieren', sk: 'Obnoviť', sl: 'Osveži' },
} satisfies Record<string, Trilingual>;

export const PDF_ERRORS: Record<WorkItemPdfFailure, Trilingual> = {
  unauthorized: {
    de: 'Kein Zugriff auf diesen Plan.',
    sk: 'Žiadny prístup k tomuto plánu.',
    sl: 'Ni dostopa do tega načrta.',
  },
  notFound: {
    de: 'Für diesen Block ist kein PDF hinterlegt.',
    sk: 'Pre tento blok nie je uložené žiadne PDF.',
    sl: 'Za ta blok ni shranjenega PDF.',
  },
  noViewer: {
    de: 'Es ist keine App zum Öffnen von PDFs installiert.',
    sk: 'Nie je nainštalovaná žiadna aplikácia na otváranie PDF.',
    sl: 'Ni nameščene aplikacije za odpiranje PDF.',
  },
  download: {
    de: 'Plan konnte nicht geladen werden.',
    sk: 'Plán sa nepodarilo načítať.',
    sl: 'Načrta ni bilo mogoče naložiti.',
  },
};
