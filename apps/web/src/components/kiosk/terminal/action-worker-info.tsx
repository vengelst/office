'use client';

import { formatDuration, formatTime } from '@/lib/timesheets';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { WorkerMe, ClockStatus } from '@/lib/timesheets';
import type { TerminalTranslate } from './types';

interface ActionWorkerInfoProps {
  worker: WorkerMe;
  clockStatus: ClockStatus | null;
  displayProjectTitle: string;
  t: TerminalTranslate;
}

export function ActionWorkerInfo({
  worker,
  clockStatus,
  displayProjectTitle,
  t,
}: ActionWorkerInfoProps) {
  const isIn = clockStatus?.clockedIn ?? false;
  const onBreak = clockStatus?.onBreak ?? false;
  const sinceStr = clockStatus?.since ? formatTime(clockStatus.since) : '';
  const breakSinceStr = clockStatus?.breakStartedAt
    ? formatTime(clockStatus.breakStartedAt)
    : '';
  const durationSec = clockStatus?.since
    ? Math.floor((Date.now() - new Date(clockStatus.since).getTime()) / 1000)
    : 0;

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-700 text-4xl font-bold uppercase">
        {worker.firstName[0]}{worker.lastName[0]}
      </div>
      <h2 className="text-4xl font-bold">
        {worker.firstName} {worker.lastName}
      </h2>
      <p className="text-center text-lg text-gray-300">
        <span className="text-gray-500">{t(KT.projectLabel)}: </span>
        {displayProjectTitle}
      </p>
      <p className={`text-xl ${isIn ? 'text-green-400' : 'text-gray-400'}`}>
        {isIn
          ? `${t(KT.clockedInSince)} ${sinceStr}`
          : t(KT.notClockedIn)}
      </p>
      {isIn && onBreak && (
        <p className="text-xl text-amber-400">
          {t(KT.onBreakSince)} {breakSinceStr}
        </p>
      )}
      {isIn && (
        <p className="text-3xl font-mono tabular-nums text-green-300">
          {formatDuration(durationSec)}
        </p>
      )}
    </div>
  );
}
