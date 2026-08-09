/**
 * DE/SK-Texte und Label-Helfer für Work-Items.
 */

import type { WorkItemPdfFailure, WorkItemStatus } from './worker-work-items';

/** Ein Begriff in beiden Sprachen. */
export interface Bilingual {
  de: string;
  sk: string;
}

/**
 * „Deutsch / Slovensky“ als eine Zeile.
 *
 * @param term - Parameter `term` (Bilingual)
 * @returns string
 */
export function both(term: Bilingual): string {
  return `${term.de} / ${term.sk}`;
}

// ── Status ─────────────────────────────────────────────────────

/** Status-Labels laut SPEZ Abschnitt 5. */
export const STATUS_LABELS: Record<WorkItemStatus, Bilingual> = {
  OPEN: { de: 'Offen', sk: 'Otvorené' },
  IN_PROGRESS: { de: 'In Arbeit', sk: 'Prebieha' },
  REVIEW: { de: 'Kontrolle', sk: 'Kontrola' },
  REWORK: { de: 'Nacharbeit', sk: 'Dodatočná práca' },
  APPROVED: { de: 'Geprüft', sk: 'Schválené' },
};

/**
 * Kurzform für Badges (eine Zeile, beide Sprachen).
 *
 * @param status - Parameter `status` (WorkItemStatus)
 * @returns string
 */
export function statusLabel(status: WorkItemStatus): string {
  return both(STATUS_LABELS[status]);
}

/**
 * Badge-Farben je Status (dunkles Theme).
 * Gleiche Farbwerte wie Mobile, hier als Tailwind-taugliche Inline-Styles.
 */
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
  // Einstieg / Überschriften
  workItems: { de: 'Arbeitsitems', sk: 'Pracovné položky' },
  myItems: { de: 'Meine Items', sk: 'Moje položky' },
  openPool: { de: 'Offen', sk: 'Otvorené' },
  currentItem: { de: 'Aktuelles Item', sk: 'Aktuálna položka' },

  // Suche / Listen
  searchKey: { de: 'Kennung suchen', sk: 'Hľadať označenie' },
  noItems: { de: 'Keine Items', sk: 'Žiadne položky' },
  noOpenItems: { de: 'Kein offenes Item', sk: 'Žiadna otvorená položka' },

  // Detail-Abschnitte
  workScope: { de: 'Arbeitsumfang', sk: 'Rozsah prác' },
  material: { de: 'Material', sk: 'Materiál' },
  floor: { de: 'Geschoss', sk: 'Poschodie' },
  area: { de: 'Bereich', sk: 'Oblasť' },
  room: { de: 'Raum', sk: 'Miestnosť' },
  type: { de: 'Typ', sk: 'Typ' },
  rc: { de: 'RC', sk: 'RC' },
  block: { de: 'Block', sk: 'Blok' },
  plan: { de: 'Plan', sk: 'Plán' },
  page: { de: 'Seite', sk: 'Strana' },
  reports: { de: 'Rückmeldungen', sk: 'Hlásenia' },
  photos: { de: 'Fotos', sk: 'Fotky' },
  reviews: { de: 'Kontrollen', sk: 'Kontroly' },
  approvedReview: { de: 'Kontrolle bestanden', sk: 'Kontrola úspešná' },
  forcedReview: { de: 'Vom PL fertig gesetzt', sk: 'Ukončené vedúcim' },
  byWorker: { de: 'von', sk: 'od' },

  // Aktionen
  claim: { de: 'Nehmen', sk: 'Prevziať' },
  setCurrent: { de: 'Als aktuell setzen', sk: 'Nastaviť ako aktuálne' },
  isCurrent: { de: 'Aktuell', sk: 'Aktuálne' },
  stopTime: { de: 'Zeit stoppen', sk: 'Zastaviť čas' },
  complete: { de: 'Fertig', sk: 'Hotovo' },
  rework: { de: 'Nacharbeit', sk: 'Dodatočná práca' },
  openPdf: { de: 'Plan / PDF', sk: 'Plán / PDF' },
  openingPdf: { de: 'PDF wird geladen…', sk: 'PDF sa načítava…' },
  camera: { de: 'Kamera', sk: 'Fotoaparát' },
  gallery: { de: 'Galerie', sk: 'Galéria' },
  send: { de: 'Senden', sk: 'Odoslať' },
  cancel: { de: 'Abbrechen', sk: 'Zrušiť' },
  commentOptional: {
    de: 'Bemerkung (optional)',
    sk: 'Poznámka (nepovinné)',
  },

  // Hinweise / Guards
  clockInFirst: {
    de: 'Erst einstempeln',
    sk: 'Najprv sa zapíš do práce',
  },
  clockInFirstHint: {
    de: 'Die Item-Zeit läuft nur, wenn du am Projekt eingestempelt bist.',
    sk: 'Čas položky beží iba vtedy, keď si zapísaný na projekte.',
  },
  waitingForReview: {
    de: 'Wartet auf Kontrolle',
    sk: 'Čaká na kontrolu',
  },
  approvedHint: {
    de: 'Geprüft – abgeschlossen',
    sk: 'Schválené – ukončené',
  },
  minPhotos: {
    de: 'Mindestens 2 Fotos (besser 2–3)',
    sk: 'Minimálne 2 fotky (lepšie 2–3)',
  },
  minPhotosMissing: {
    de: 'Bitte mindestens 2 Fotos aufnehmen.',
    sk: 'Nasnímaj prosím aspoň 2 fotky.',
  },
  claimFirst: {
    de: 'Item zuerst nehmen',
    sk: 'Najprv prevziať položku',
  },
  cameraPermission: {
    de: 'Kamera-Zugriff wird benötigt.',
    sk: 'Potrebný prístup k fotoaparátu.',
  },
  galleryPermission: {
    de: 'Zugriff auf Fotos wird benötigt.',
    sk: 'Potrebný prístup k fotkám.',
  },
  timeRunning: { de: 'Zeit läuft', sk: 'Čas beží' },

  // Meldungen
  error: { de: 'Fehler', sk: 'Chyba' },
  hint: { de: 'Hinweis', sk: 'Upozornenie' },
  done: { de: 'Erledigt', sk: 'Hotovo' },
  completeSent: {
    de: 'Fertigmeldung gesendet – wartet auf Kontrolle.',
    sk: 'Hlásenie odoslané – čaká na kontrolu.',
  },
  reworkSent: {
    de: 'Nacharbeit gemeldet – Item bleibt bei dir.',
    sk: 'Nahlásená dodatočná práca – položka ostáva u teba.',
  },
  claimed: { de: 'Item genommen.', sk: 'Položka prevzatá.' },
  loadFailed: {
    de: 'Daten konnten nicht geladen werden.',
    sk: 'Údaje sa nepodarilo načítať.',
  },
  openItemsStay: {
    de: 'Offene Items bleiben dir zugeordnet.',
    sk: 'Otvorené položky ostávajú priradené tebe.',
  },

  // ── Nur Web ──────────────────────────────────────────────────
  // Kein Gegenstück in der APK: Dort öffnet ein externer PDF-Viewer,
  // im Browser liegt das PDF als Blob in einem Overlay.
  back: { de: 'Zurück', sk: 'Späť' },
  close: { de: 'Schließen', sk: 'Zavrieť' },
  openInNewTab: { de: 'In neuem Tab öffnen', sk: 'Otvoriť na novej karte' },
  loading: { de: 'Lädt…', sk: 'Načítava…' },
  refresh: { de: 'Aktualisieren', sk: 'Obnoviť' },
} satisfies Record<string, Bilingual>;

/** Fehlertexte beim Öffnen des Block-PDFs (`WorkItemPdfError.reason`). */
export const PDF_ERRORS: Record<WorkItemPdfFailure, Bilingual> = {
  unauthorized: {
    de: 'Kein Zugriff auf diesen Plan.',
    sk: 'Žiadny prístup k tomuto plánu.',
  },
  notFound: {
    de: 'Für diesen Block ist kein PDF hinterlegt.',
    sk: 'Pre tento blok nie je uložené žiadne PDF.',
  },
  noViewer: {
    de: 'Es ist keine App zum Öffnen von PDFs installiert.',
    sk: 'Nie je nainštalovaná žiadna aplikácia na otváranie PDF.',
  },
  download: {
    de: 'Plan konnte nicht geladen werden.',
    sk: 'Plán sa nepodarilo načítať.',
  },
};
