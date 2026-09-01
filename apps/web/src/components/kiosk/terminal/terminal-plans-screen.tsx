/**
 * Kiosk-Screen: aktuelle Projektpläne (nur isLatest) öffnen/downloaden.
 */

'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import {
  kioskApi,
  type KioskPlan,
} from '@/lib/timesheets';
import { kioskDebugLog } from '@/lib/kiosk-debug';
import type { KioskState, TerminalTranslate } from './types';

interface TerminalPlansScreenProps {
  projectId: string;
  countdown: number;
  t: TerminalTranslate;
  onPointerDown: () => void;
  resetActivity: () => void;
  setState: (state: KioskState) => void;
}

/**
 * Liste der aktuellen Pläne des Kiosk-Projekts; Tippen öffnet/lädt die Datei.
 */
export function TerminalPlansScreen({
  projectId,
  countdown,
  t,
  onPointerDown,
  resetActivity,
  setState,
}: TerminalPlansScreenProps): ReactNode {
  const [plans, setPlans] = useState<KioskPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    kioskApi
      .listPlans(projectId)
      .then(setPlans)
      .catch((err: unknown) => {
        kioskDebugLog('error', 'plans list failed', String(err));
        setError(t(KT.plansError));
        setPlans([]);
      })
      .finally(() => setLoading(false));
  }, [projectId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openPlan = async (plan: KioskPlan): Promise<void> => {
    resetActivity();
    setOpeningId(plan.id);
    try {
      const url = await kioskApi.planFileObjectUrl(projectId, plan.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      kioskDebugLog('error', 'plans open failed', String(err));
      setError(t(KT.plansOpenError));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-950 p-6 text-white"
      onClick={resetActivity}
      onTouchStart={resetActivity}
      onPointerDown={onPointerDown}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setState('action')}
          className="min-h-[44px] rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-200 transition hover:bg-gray-700"
        >
          ← {t(KT.back)}
        </button>
        <h1 className="text-2xl font-semibold">{t(KT.plans)}</h1>
        <div className="min-w-[3rem] text-right text-lg tabular-nums text-gray-400">
          {countdown > 0 ? countdown : ''}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-lg text-gray-400">{t(KT.processing)}</p>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-center text-lg text-amber-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="min-h-[44px] rounded-xl bg-gray-800 px-6 py-3 text-lg"
          >
            {t(KT.back)}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-xl text-gray-400">
          {t(KT.plansEmpty)}
        </p>
      ) : (
        <ul className="mx-auto flex w-full max-w-xl flex-col gap-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                disabled={openingId === plan.id}
                onClick={() => void openPlan(plan)}
                className="flex w-full min-h-[44px] flex-col items-start gap-1 rounded-2xl bg-gray-900 px-5 py-4 text-left transition hover:bg-gray-800 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="text-xl font-semibold">
                  {plan.title || plan.originalFilename}
                </span>
                <span className="text-sm text-gray-400">
                  {t(KT.plansRev).replace('{n}', String(plan.version))} ·{' '}
                  {plan.originalFilename}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
