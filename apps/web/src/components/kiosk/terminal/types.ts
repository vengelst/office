import type { KioskLang, Trilingual } from '@/lib/kiosk-locale';

export const KIOSK_CONFIG_KEY = 'office_kiosk_config';

export type TerminalTranslate = (term: Trilingual) => string;
export type TerminalSetLang = (lang: KioskLang) => void;

/**
 * Mindest-Leerlauf auf den Arbeitsitems-Screens.
 *
 * Der Kiosk-Auto-Logout (Default 15 s) passt zum Stempeln mit zwei Tipps, nicht
 * zum Lesen einer Arbeitskarte oder zum Fotografieren – dabei liegt das Tablet
 * unberührt in der Hand. Jede Interaktion setzt den Zähler wie gewohnt zurück,
 * nur das Fenster ist hier größer (nie kleiner als die konfigurierte Zeit).
 */
export const ITEMS_IDLE_SECONDS = 180;

export type KioskState =
  | 'idle'
  | 'action'
  | 'confirmation'
  | 'items'
  | 'itemDetail'
  | 'plans';

/** Screens, auf denen die Monteur-Session weiterläuft (Auto-Logout aktiv). */
export const SESSION_STATES: KioskState[] = [
  'action',
  'items',
  'itemDetail',
  'plans',
];

export interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number;
}
