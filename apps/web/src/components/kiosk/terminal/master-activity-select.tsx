'use client';

import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { ActivityTypeItem } from '@/lib/activity-types';
import type { ClockStatus } from '@/lib/timesheets';
import type { TerminalTranslate } from './types';

interface MasterActivitySelectProps {
  activityTypes: ActivityTypeItem[];
  selectedActivityTypeId: string | null;
  clockStatus: ClockStatus | null;
  isIn: boolean;
  onBreak?: boolean;
  t: TerminalTranslate;
  resetActivity: () => void;
  onActivityTypeChange: (id: string | null) => void;
}

/**
 * Große Tätigkeits-Buttons für Kiosk (vor und während der Schicht).
 * Monteur soll klar sehen: „Woran arbeite ich?“
 */
export function MasterActivitySelect({
  activityTypes,
  selectedActivityTypeId,
  clockStatus,
  isIn,
  onBreak = false,
  t,
  resetActivity,
  onActivityTypeChange,
}: MasterActivitySelectProps) {
  return (
    <div className="mx-auto mt-4 w-full max-w-lg">
      <p className="mb-1 text-center text-xl font-semibold text-white">
        {isIn ? t(KT.switchActivity) : t(KT.chooseActivity)}
      </p>
      <p className="mb-3 text-center text-sm text-gray-400">
        {t(KT.activityHint)}
      </p>
      {isIn && clockStatus?.currentActivity && (
        <p className="mb-3 rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-center text-base text-emerald-300">
          {t(KT.currentActivity)}:{' '}
          <span className="font-semibold text-emerald-200">
            {clockStatus.currentActivity.name}
          </span>
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {activityTypes.map((a) => {
          const selected = a.id === selectedActivityTypeId;
          return (
            <button
              key={a.id}
              type="button"
              disabled={onBreak}
              onClick={() => {
                resetActivity();
                onActivityTypeChange(a.id);
              }}
              className={`min-h-[64px] rounded-xl border px-4 py-4 text-left text-lg font-medium transition disabled:opacity-50 ${
                selected
                  ? 'border-blue-400 bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'border-gray-700 bg-gray-800 text-gray-100 hover:border-gray-500 hover:bg-gray-700'
              }`}
            >
              {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
