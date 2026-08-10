/**
 * Kiosk-Sprache (DE / SK / SL) – Gerätweise in localStorage.
 * Office-UI bleibt Deutsch; nur die Monteur-Fläche am Terminal wechselt.
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type KioskLang = 'de' | 'sk' | 'sl';

export const KIOSK_LANG_KEY = 'office_kiosk_lang';

export const KIOSK_LANGS: { id: KioskLang; label: string }[] = [
  { id: 'de', label: 'DE' },
  { id: 'sk', label: 'SK' },
  { id: 'sl', label: 'SL' },
];

export const KIOSK_DATE_LOCALES: Record<KioskLang, string> = {
  de: 'de-DE',
  sk: 'sk-SK',
  sl: 'sl-SI',
};

/** Ein UI-Begriff in den drei Kiosk-Sprachen. */
export interface Trilingual {
  de: string;
  sk: string;
  sl: string;
}

export function pick(term: Trilingual, lang: KioskLang): string {
  return term[lang];
}

interface KioskLocaleContextValue {
  lang: KioskLang;
  setLang: (lang: KioskLang) => void;
  t: (term: Trilingual) => string;
  dateLocale: string;
}

const KioskLocaleContext = createContext<KioskLocaleContextValue | null>(null);

function readStoredLang(): KioskLang {
  if (typeof window === 'undefined') return 'de';
  const raw = localStorage.getItem(KIOSK_LANG_KEY);
  if (raw === 'de' || raw === 'sk' || raw === 'sl') return raw;
  return 'de';
}

export function KioskLocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<KioskLang>('de');

  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  const setLang = useCallback((next: KioskLang) => {
    setLangState(next);
    localStorage.setItem(KIOSK_LANG_KEY, next);
  }, []);

  const value = useMemo<KioskLocaleContextValue>(
    () => ({
      lang,
      setLang,
      t: (term) => pick(term, lang),
      dateLocale: KIOSK_DATE_LOCALES[lang],
    }),
    [lang, setLang],
  );

  return (
    <KioskLocaleContext.Provider value={value}>
      {children}
    </KioskLocaleContext.Provider>
  );
}

/** Pflicht im Kiosk-Layout. */
export function useKioskLocale(): KioskLocaleContextValue {
  const ctx = useContext(KioskLocaleContext);
  if (!ctx) {
    throw new Error('useKioskLocale needs KioskLocaleProvider');
  }
  return ctx;
}

/** Optional – außerhalb des Kiosks (z. B. /worker-app) → null. */
export function useOptionalKioskLocale(): KioskLocaleContextValue | null {
  return useContext(KioskLocaleContext);
}
