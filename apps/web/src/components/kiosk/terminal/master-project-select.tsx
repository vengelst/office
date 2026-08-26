'use client';

import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import type { TerminalTranslate } from './types';

interface MasterProjectSelectProps {
  config: KioskConfig;
  activeProjectId: string;
  masterProjectOptions: Array<{
    id: string;
    title: string;
    projectNumber: string;
  }>;
  t: TerminalTranslate;
  resetActivity: () => void;
  onProjectChange: (projectId: string) => void;
}

export function MasterProjectSelect({
  config,
  activeProjectId,
  masterProjectOptions,
  t,
  resetActivity,
  onProjectChange,
}: MasterProjectSelectProps) {
  return (
    <div className="mx-auto mt-6 w-full max-w-md">
      <label className="mb-2 block text-center text-sm text-gray-400">
        {t(KT.chooseProject)}
      </label>
      <select
        value={activeProjectId}
        onChange={(e) => {
          resetActivity();
          onProjectChange(e.target.value);
        }}
        className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-lg text-white"
        style={{ minHeight: '56px' }}
      >
        {!masterProjectOptions.some((p) => p.id === config.projectId) && (
          <option value={config.projectId}>{config.projectTitle}</option>
        )}
        {masterProjectOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.projectNumber ? `${p.projectNumber} · ` : ''}
            {p.title}
          </option>
        ))}
      </select>
      <p className="mt-2 text-center text-xs text-gray-500">
        {t(KT.bookingOn)}
      </p>
    </div>
  );
}
