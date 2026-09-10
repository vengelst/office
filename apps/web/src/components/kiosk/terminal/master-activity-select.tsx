'use client';

import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { ClockStatus } from '@/lib/timesheets';
import type { TerminalTranslate } from './types';

export type WorkActivityOption = { id: string; label: string };

interface MasterActivitySelectProps {
  workActivities: WorkActivityOption[];
  selectedWorkActivityId: string | null;
  customWorkLabel: string;
  clockStatus: ClockStatus | null;
  isIn: boolean;
  onBreak?: boolean;
  t: TerminalTranslate;
  resetActivity: () => void;
  onWorkActivityChange: (id: string | null) => void;
  onCustomWorkLabelChange: (label: string) => void;
  onApplyCustomWork: () => void;
}

/**
 * Projekt-Arbeiten wählen oder eigene Tätigkeit anlegen (Kiosk).
 */
export function MasterActivitySelect({
  workActivities,
  selectedWorkActivityId,
  customWorkLabel,
  clockStatus,
  isIn,
  onBreak = false,
  t,
  resetActivity,
  onWorkActivityChange,
  onCustomWorkLabelChange,
  onApplyCustomWork,
}: MasterActivitySelectProps) {
  const currentLabel =
    clockStatus?.currentWorkActivity?.label ??
    clockStatus?.currentActivity?.name ??
    null;

  return (
    <div className="mx-auto mt-4 w-full max-w-lg">
      <p className="mb-1 text-center text-xl font-semibold text-white">
        {isIn ? t(KT.switchActivity) : t(KT.chooseActivity)}
      </p>
      <p className="mb-3 text-center text-sm text-gray-400">
        {t(KT.activityHint)}
      </p>
      {isIn && currentLabel && (
        <p className="mb-3 rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-center text-base text-emerald-300">
          {t(KT.currentActivity)}:{' '}
          <span className="font-semibold text-emerald-200">{currentLabel}</span>
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {workActivities.map((a) => {
          const selected = a.id === selectedWorkActivityId && !customWorkLabel.trim();
          return (
            <button
              key={a.id}
              type="button"
              disabled={onBreak}
              onClick={() => {
                resetActivity();
                onCustomWorkLabelChange('');
                onWorkActivityChange(a.id);
              }}
              className={`min-h-[64px] rounded-xl border px-4 py-4 text-left text-lg font-medium transition disabled:opacity-50 ${
                selected
                  ? 'border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'border-gray-700 bg-gray-800 text-gray-100 hover:border-gray-500 hover:bg-gray-700'
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/60 p-3">
        <p className="mb-2 text-sm font-medium text-gray-300">
          Eigene Tätigkeit
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customWorkLabel}
            disabled={onBreak}
            maxLength={120}
            placeholder="z. B. Kabeltrasse ziehen"
            onChange={(e) => {
              onWorkActivityChange(null);
              onCustomWorkLabelChange(e.target.value);
            }}
            className="min-h-[52px] flex-1 rounded-xl border border-gray-600 bg-gray-800 px-3 text-base text-white placeholder:text-gray-500"
          />
          {isIn && (
            <button
              type="button"
              disabled={onBreak || !customWorkLabel.trim()}
              onClick={() => {
                resetActivity();
                onApplyCustomWork();
              }}
              className="min-h-[52px] rounded-xl bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-40"
            >
              Übernehmen
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Neue Bezeichnung wird am Projekt gespeichert und ist danach wählbar.
        </p>
      </div>
    </div>
  );
}
