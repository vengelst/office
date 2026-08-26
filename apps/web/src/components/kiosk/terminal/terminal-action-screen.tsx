'use client';

import { OfflineClockBanner } from '@/components/offline-clock-banner';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import type { WorkerMe, ClockStatus, KioskWorkerStatus } from '@/lib/timesheets';
import type { ActivityTypeItem } from '@/lib/activity-types';
import type { KioskState, TerminalTranslate } from './types';
import { ActionWorkerInfo } from './action-worker-info';
import { MasterProjectSelect } from './master-project-select';
import { MasterActivitySelect } from './master-activity-select';
import { LiveWorkersOverview } from './live-workers-overview';
import { ActionButtonsPanel } from './action-buttons-panel';
import { ActionPhotoOverlay } from './action-photo-overlay';

interface TerminalActionScreenProps {
  worker: WorkerMe;
  config: KioskConfig;
  clockStatus: ClockStatus | null;
  activityTypes: ActivityTypeItem[];
  selectedActivityTypeId: string | null;
  liveWorkers: KioskWorkerStatus[];
  activeProjectId: string;
  displayProjectTitle: string;
  masterProjectOptions: Array<{
    id: string;
    title: string;
    projectNumber: string;
  }>;
  canClockInOnKioskProject: boolean;
  itemBasedProject: boolean;
  processing: boolean;
  countdown: number;
  photoPending: File | null;
  photoComment: string;
  timeStr: string;
  dateLocale: string;
  t: TerminalTranslate;
  onPointerDown: () => void;
  resetActivity: () => void;
  endSession: () => Promise<void>;
  setState: (state: KioskState) => void;
  setSelectedProjectId: (id: string) => void;
  setPhotoPending: (file: File | null) => void;
  setPhotoComment: (comment: string) => void;
  handleActivityTypeChange: (id: string | null) => void;
  handleClockIn: () => void;
  handleClockOut: () => void;
  handleBreakStart: () => void;
  handleBreakEnd: () => void;
  handlePhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadPhotoWithComment: (opts: {
    comment: string;
    xNorm?: number | null;
    yNorm?: number | null;
  }) => Promise<void>;
}

export function TerminalActionScreen({
  worker,
  config,
  clockStatus,
  activityTypes,
  selectedActivityTypeId,
  liveWorkers,
  activeProjectId,
  displayProjectTitle,
  masterProjectOptions,
  canClockInOnKioskProject,
  itemBasedProject,
  processing,
  countdown,
  photoPending,
  photoComment,
  timeStr,
  dateLocale,
  t,
  onPointerDown,
  resetActivity,
  endSession,
  setState,
  setSelectedProjectId,
  setPhotoPending,
  setPhotoComment,
  handleActivityTypeChange,
  handleClockIn,
  handleClockOut,
  handleBreakStart,
  handleBreakEnd,
  handlePhoto,
  uploadPhotoWithComment,
}: TerminalActionScreenProps) {
  const isIn = clockStatus?.clockedIn ?? false;

  return (
    <div
      className="flex min-h-screen flex-col p-6"
      onClick={resetActivity}
      onTouchStart={resetActivity}
      onPointerDown={onPointerDown}
    >
      <OfflineClockBanner
        workerId={worker.id}
        variant="dark"
        className="mb-4"
      />

      <div className="flex items-start justify-between">
        <button
          onClick={() => {
            void endSession();
          }}
          className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
        >
          ← {t(KT.back)}
        </button>
        <div className="text-right text-xl tabular-nums text-gray-400">
          {timeStr}
        </div>
      </div>

      <ActionWorkerInfo
        worker={worker}
        clockStatus={clockStatus}
        displayProjectTitle={displayProjectTitle}
        t={t}
      />

      {worker.masterEngineer && !isIn && masterProjectOptions.length > 0 && (
        <MasterProjectSelect
          config={config}
          activeProjectId={activeProjectId}
          masterProjectOptions={masterProjectOptions}
          t={t}
          resetActivity={resetActivity}
          onProjectChange={setSelectedProjectId}
        />
      )}

      {worker.masterEngineer && activityTypes.length > 0 && (
        <MasterActivitySelect
          activityTypes={activityTypes}
          selectedActivityTypeId={selectedActivityTypeId}
          clockStatus={clockStatus}
          isIn={isIn}
          t={t}
          resetActivity={resetActivity}
          onActivityTypeChange={handleActivityTypeChange}
        />
      )}

      {worker.masterEngineer && liveWorkers.length > 0 && (
        <LiveWorkersOverview liveWorkers={liveWorkers} t={t} />
      )}

      <ActionButtonsPanel
        worker={worker}
        config={config}
        isIn={isIn}
        onBreak={clockStatus?.onBreak ?? false}
        processing={processing}
        canClockInOnKioskProject={canClockInOnKioskProject}
        itemBasedProject={itemBasedProject}
        dateLocale={dateLocale}
        t={t}
        resetActivity={resetActivity}
        setState={setState}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onBreakStart={() => void handleBreakStart()}
        onBreakEnd={() => void handleBreakEnd()}
        onPhoto={handlePhoto}
      />

      {photoPending && (
        <ActionPhotoOverlay
          photoPending={photoPending}
          photoComment={photoComment}
          processing={processing}
          t={t}
          onCommentChange={setPhotoComment}
          onSave={(p) =>
            void uploadPhotoWithComment({
              comment: p.comment,
              xNorm: p.xNorm,
              yNorm: p.yNorm,
            })
          }
          onSkip={() => void uploadPhotoWithComment({ comment: '' })}
          onCancel={() => {
            setPhotoPending(null);
            setPhotoComment('');
          }}
        />
      )}

      <div className="fixed bottom-4 left-0 right-0 text-center text-sm text-gray-600">
        {t(KT.autoLogout(countdown))}
      </div>
    </div>
  );
}
