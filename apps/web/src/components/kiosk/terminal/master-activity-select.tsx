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
  t: TerminalTranslate;
  resetActivity: () => void;
  onActivityTypeChange: (id: string | null) => void;
}

export function MasterActivitySelect({
  activityTypes,
  selectedActivityTypeId,
  clockStatus,
  isIn,
  t,
  resetActivity,
  onActivityTypeChange,
}: MasterActivitySelectProps) {
  return (
    <div className="mx-auto mt-4 w-full max-w-md">
      <label className="mb-2 block text-center text-sm text-gray-400">
        {isIn ? t(KT.switchActivity) : t(KT.chooseActivity)}
      </label>
      {isIn && clockStatus?.currentActivity && (
        <p className="mb-2 text-center text-sm text-emerald-400">
          {t(KT.currentActivity)}: {clockStatus.currentActivity.name}
        </p>
      )}
      <select
        value={selectedActivityTypeId ?? ''}
        onChange={(e) => {
          resetActivity();
          onActivityTypeChange(e.target.value || null);
        }}
        className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-lg text-white"
        style={{ minHeight: '56px' }}
      >
        {activityTypes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
