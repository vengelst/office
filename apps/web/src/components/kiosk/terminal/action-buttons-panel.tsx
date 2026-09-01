'use client';

import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import type { WorkerMe } from '@/lib/timesheets';
import type { KioskState, TerminalTranslate } from './types';

interface ActionButtonsPanelProps {
  worker: WorkerMe;
  config: KioskConfig;
  isIn: boolean;
  onBreak: boolean;
  processing: boolean;
  canClockInOnKioskProject: boolean;
  itemBasedProject: boolean;
  dateLocale: string;
  t: TerminalTranslate;
  resetActivity: () => void;
  setState: (state: KioskState) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onBreakStart: () => void;
  onBreakEnd: () => void;
  onPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ActionButtonsPanel({
  worker,
  config,
  isIn,
  onBreak,
  processing,
  canClockInOnKioskProject,
  itemBasedProject,
  dateLocale,
  t,
  resetActivity,
  setState,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  onPhoto,
}: ActionButtonsPanelProps) {
  return (
    <div className="mt-auto flex flex-col items-center gap-4 pb-8">
      {!isIn ? (
        <>
          <button
            onClick={onClockIn}
            disabled={processing || !canClockInOnKioskProject}
            className="w-full max-w-md rounded-2xl bg-green-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-green-900/50 transition hover:bg-green-500 active:scale-95 disabled:opacity-60"
            style={{ minHeight: '120px' }}
          >
            {processing ? t(KT.processing) : `▶ ${t(KT.startWork)}`}
          </button>
          {!canClockInOnKioskProject && (
            <p className="max-w-md text-center text-sm text-amber-400">
              {t(KT.noAssignment)}
            </p>
          )}
        </>
      ) : (
        <>
          {onBreak ? (
            <button
              onClick={onBreakEnd}
              disabled={processing}
              className="w-full max-w-md rounded-2xl bg-amber-600 px-8 py-6 text-2xl font-bold text-white shadow-lg shadow-amber-900/40 transition hover:bg-amber-500 active:scale-95 disabled:opacity-60"
              style={{ minHeight: '88px' }}
            >
              {processing ? t(KT.processing) : t(KT.endBreak)}
            </button>
          ) : (
            <button
              onClick={onBreakStart}
              disabled={processing}
              className="w-full max-w-md rounded-xl bg-amber-700/90 px-6 py-4 text-xl font-semibold text-white transition hover:bg-amber-600 active:scale-95 disabled:opacity-60"
              style={{ minHeight: '64px' }}
            >
              {processing ? t(KT.processing) : t(KT.startBreak)}
            </button>
          )}
          <button
            onClick={onClockOut}
            disabled={processing}
            className="w-full max-w-md rounded-2xl bg-red-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-red-900/50 transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
            style={{ minHeight: '120px' }}
          >
            {processing ? t(KT.processing) : `■ ${t(KT.stopWork)}`}
          </button>
          {config.cameraEnabled && (
            <label className="w-full max-w-md cursor-pointer rounded-xl bg-gray-800 px-6 py-4 text-center text-xl text-gray-200 transition hover:bg-gray-700">
              📷 {t(KT.takePhoto)}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPhoto}
                className="hidden"
              />
            </label>
          )}
          {itemBasedProject && (
            <button
              onClick={() => {
                resetActivity();
                setState('items');
              }}
              className="w-full max-w-md rounded-xl bg-blue-600/90 px-6 py-4 text-center text-xl font-semibold text-white transition hover:bg-blue-500 active:scale-95"
            >
              📋 {t(KT.workItems)}
            </button>
          )}
        </>
      )}

      <button
        onClick={() => {
          resetActivity();
          setState('plans');
        }}
        className="w-full max-w-md rounded-xl bg-slate-700 px-6 py-4 text-center text-xl font-semibold text-white transition hover:bg-slate-600 active:scale-95"
        style={{ minHeight: '44px' }}
      >
        📐 {t(KT.plans)}
      </button>

      {!isIn && worker.assignments.length > 1 && (
        <div className="mt-4 w-full max-w-md rounded-xl bg-gray-800/50 p-4">
          <h4 className="mb-2 text-sm font-medium text-gray-500">{t(KT.upcomingProjects)}</h4>
          {worker.assignments.slice(1).map((a) => (
            <div key={a.id} className="text-sm text-gray-500">
              {a.project.title}
              {a.startDate && ` (ab ${new Date(a.startDate).toLocaleDateString(dateLocale)})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
