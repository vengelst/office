'use client';

import { formatTime, type KioskWorkerStatus } from '@/lib/timesheets';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { TerminalTranslate } from './types';

interface LiveWorkersOverviewProps {
  liveWorkers: KioskWorkerStatus[];
  t: TerminalTranslate;
}

export function LiveWorkersOverview({ liveWorkers, t }: LiveWorkersOverviewProps) {
  return (
    <div className="mx-auto mt-6 w-full max-w-md rounded-xl bg-gray-900/80 p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-500">
        {t(KT.liveOverview)}
      </h3>
      <div className="space-y-2">
        {liveWorkers
          .filter((w) => w.clockedIn)
          .map((w) => (
            <div key={w.workerId} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="text-gray-200">
                {w.firstName} {w.lastName}
              </span>
              {w.since && (
                <span className="ml-auto text-gray-500">
                  {t(KT.since)} {formatTime(w.since)}
                </span>
              )}
            </div>
          ))}
      </div>
      {liveWorkers.some((w) => !w.clockedIn) && (
        <>
          <h4 className="mb-2 mt-4 text-xs font-medium text-gray-600">
            {t(KT.notOnSite)}
          </h4>
          <div className="space-y-1">
            {liveWorkers
              .filter((w) => !w.clockedIn)
              .map((w) => (
                <div
                  key={w.workerId}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-600" />
                  <span className="text-gray-500">
                    {w.firstName} {w.lastName}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
