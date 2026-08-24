'use client';

/**
 * Ersteinstieg: Kiosk als App auf dem Home-Bildschirm speichern.
 * Android/Chrome: vorinstalliertes Prompt (beforeinstallprompt).
 * iPhone/iPad: Anleitung „Teilen → Zum Home-Bildschirm“ (Safari).
 */

import { useCallback, useEffect, useState } from 'react';
import { texts } from '@/lib/texts';

const DISMISS_KEY = 'office_kiosk_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS meldet sich oft als Mac
  return (
    window.navigator.platform === 'MacIntel' &&
    window.navigator.maxTouchPoints > 1
  );
}

export function KioskInstallPrompt(): React.ReactNode {
  const t = texts.kiosk.install;
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // private mode
    }

    setIos(isIosDevice());
    setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = useCallback((permanent: boolean) => {
    if (permanent) {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // ignore
      }
    }
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setDeferred(null);
    dismiss(true);
  }, [deferred, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 p-4"
      role="dialog"
      aria-labelledby="kiosk-install-title"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl shadow-black/50">
        <h2
          id="kiosk-install-title"
          className="text-xl font-bold text-gray-50"
        >
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-gray-400">{t.subtitle}</p>

        {ios ? (
          <ol className="mt-4 space-y-2 text-sm text-gray-300">
            <li>
              <span className="font-semibold text-blue-400">1.</span> {t.iosStep1}
            </li>
            <li>
              <span className="font-semibold text-blue-400">2.</span> {t.iosStep2}
            </li>
            <li>
              <span className="font-semibold text-blue-400">3.</span> {t.iosStep3}
            </li>
          </ol>
        ) : (
          <p className="mt-3 text-sm text-gray-400">{t.androidHint}</p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!ios && deferred && (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
              style={{ minHeight: '48px' }}
            >
              {t.installButton}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-base font-medium text-gray-200 transition hover:bg-gray-700"
            style={{ minHeight: '48px' }}
          >
            {t.later}
          </button>
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-xl px-4 py-3 text-sm text-gray-500 transition hover:text-gray-300"
            style={{ minHeight: '44px' }}
          >
            {t.never}
          </button>
        </div>
      </div>
    </div>
  );
}
