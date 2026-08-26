'use client';

import { WorkItemsList } from '@/components/worker-work-items/work-items-list';
import { WorkItemDetail } from '@/components/worker-work-items/work-item-detail';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { KioskState, TerminalTranslate } from './types';
import type { WorkerMe } from '@/lib/timesheets';

interface TerminalWorkItemsScreenProps {
  state: KioskState;
  worker: WorkerMe;
  projectId: string;
  selectedItemId: string | null;
  countdown: number;
  t: TerminalTranslate;
  onPointerDown: () => void;
  resetActivity: () => void;
  setState: (state: KioskState) => void;
  setSelectedItemId: (id: string | null) => void;
}

export function TerminalWorkItemsScreen({
  state,
  worker,
  projectId,
  selectedItemId,
  countdown,
  t,
  onPointerDown,
  resetActivity,
  setState,
  setSelectedItemId,
}: TerminalWorkItemsScreenProps) {
  return (
    <div
      onClick={resetActivity}
      onTouchStart={resetActivity}
      onKeyDown={resetActivity}
      onPointerDown={onPointerDown}
    >
      {state === 'items' ? (
        <WorkItemsList
          workerId={worker.id}
          projectId={projectId}
          onActivity={resetActivity}
          onSelect={(id) => {
            resetActivity();
            setSelectedItemId(id);
            setState('itemDetail');
          }}
          onBack={() => {
            resetActivity();
            setState('action');
          }}
        />
      ) : (
        selectedItemId && (
          <WorkItemDetail
            itemId={selectedItemId}
            workerId={worker.id}
            onActivity={resetActivity}
            onBack={() => {
              resetActivity();
              setSelectedItemId(null);
              setState('items');
            }}
          />
        )
      )}
      {countdown > 0 && countdown <= 30 && (
        <div className="fixed bottom-2 left-0 right-0 text-center text-xs text-gray-500">
          {t(KT.autoLogout(countdown))}
        </div>
      )}
    </div>
  );
}
