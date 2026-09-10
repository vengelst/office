'use client';

/**
 * Soft-Landing für den Kiosk (#37): Abkündigung + Links zur Personal-App.
 * Setup/Terminal bleiben als Notfall erreichbar.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { kioskDebugLog } from '@/lib/kiosk-debug';
import { texts } from '@/lib/texts';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

export default function KioskPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.kiosk.deprecation;
  const [legacyTarget, setLegacyTarget] = useState<string | null>(null);

  useEffect(() => {
    kioskDebugLog('nav', '/kiosk Einstieg (Soft-Landing)');
    const raw = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (!raw) {
      setLegacyTarget('/kiosk/setup');
      return;
    }
    try {
      const config = JSON.parse(raw) as {
        projectId?: string;
        mode?: string;
        projectTitle?: string;
      };
      if (config.projectId) {
        const target =
          config.mode === 'customer_pl' ? '/kiosk/pl' : '/kiosk/terminal';
        kioskDebugLog('info', `Legacy-Ziel ${target}`, config.projectTitle);
        setLegacyTarget(target);
        return;
      }
    } catch {
      kioskDebugLog('warn', 'ungültige Kiosk-Config');
    }
    setLegacyTarget('/kiosk/setup');
  }, []);

  const continueLegacy = useCallback(() => {
    if (!legacyTarget) return;
    kioskDebugLog('nav', `Notfall weiter → ${legacyTarget}`);
    router.push(legacyTarget);
  }, [legacyTarget, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-950 px-6 py-10 text-gray-100">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
          Hinweis
        </p>
        <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
        <p className="text-base text-gray-300">{t.body}</p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <Link
          href="/worker-app"
          className="flex min-h-[52px] items-center justify-center rounded-xl bg-blue-600 px-4 text-lg font-semibold text-white transition hover:bg-blue-500"
        >
          {t.workerCta}
        </Link>
        <Link
          href="/pl/login"
          className="flex min-h-[52px] items-center justify-center rounded-xl bg-emerald-700 px-4 text-lg font-semibold text-white transition hover:bg-emerald-600"
        >
          {t.plCta}
        </Link>
        <button
          type="button"
          onClick={continueLegacy}
          disabled={!legacyTarget}
          className="mt-4 min-h-[48px] rounded-xl border border-gray-700 px-4 text-sm text-gray-400 transition hover:border-gray-500 hover:text-gray-200 disabled:opacity-40"
        >
          {t.continueKiosk}
        </button>
      </div>
    </div>
  );
}
