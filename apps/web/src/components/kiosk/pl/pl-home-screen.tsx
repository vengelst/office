'use client';

import { texts } from '@/lib/texts';
import { formatMinutes, type TimesheetListItem } from '@/lib/timesheets';
import { KioskPlItemBoard } from '@/components/kiosk/pl-item-board';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import type { AuthUser } from '@office/types';
import { PlAutoLogoutBanner } from './pl-auto-logout-banner';
import type { MainTab } from './types';

interface PlHomeScreenProps {
  config: KioskConfig;
  user: AuthUser;
  itemBased: boolean;
  mainTab: MainTab;
  sheets: TimesheetListItem[];
  sheetsLoading: boolean;
  detailLoading: boolean;
  countdown: number;
  timeStr: string;
  onPointerDown: () => void;
  resetActivity: () => void;
  resetToIdle: () => void;
  setMainTab: (tab: MainTab) => void;
  loadSheets: () => void;
  loadDetail: (id: string) => void;
}

export function PlHomeScreen({
  config,
  user,
  itemBased,
  mainTab,
  sheets,
  sheetsLoading,
  detailLoading,
  countdown,
  timeStr,
  onPointerDown,
  resetActivity,
  resetToIdle,
  setMainTab,
  loadSheets,
  loadDetail,
}: PlHomeScreenProps) {
  const t = texts.kiosk.pl;
  const tTimesheets = texts.timesheets;

  return (
    <div
      className="flex min-h-screen flex-col p-4"
      onClick={resetActivity}
      onTouchStart={resetActivity}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={resetToIdle}
          className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
          style={{ minHeight: '44px' }}
        >
          ← {t.back}
        </button>
        <div className="text-right text-xl tabular-nums text-gray-400">{timeStr}</div>
      </div>

      <div className="mt-4 text-center">
        <h2 className="text-2xl font-bold">{config.projectTitle}</h2>
        <p className="text-sm text-gray-500">{user.displayName}</p>
      </div>

      {itemBased ? (
        <div className="mx-auto mt-4 flex w-full max-w-lg gap-2">
          <button
            type="button"
            onClick={() => {
              resetActivity();
              setMainTab('items');
            }}
            className={`flex-1 rounded-xl px-4 py-3 text-lg font-semibold transition active:scale-95 ${
              mainTab === 'items'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            style={{ minHeight: '48px' }}
          >
            {t.tabs.items}
          </button>
          <button
            type="button"
            onClick={() => {
              resetActivity();
              setMainTab('timesheets');
              loadSheets();
            }}
            className={`flex-1 rounded-xl px-4 py-3 text-lg font-semibold transition active:scale-95 ${
              mainTab === 'timesheets'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            style={{ minHeight: '48px' }}
          >
            {t.tabs.timesheets}
          </button>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <h3 className="text-xl font-bold">{t.listTitle}</h3>
        </div>
      )}

      <div className="mt-6 flex flex-1 flex-col">
        {mainTab === 'items' && itemBased ? (
          <KioskPlItemBoard projectId={config.projectId} onActivity={resetActivity} />
        ) : (
          <>
            {itemBased && (
              <h3 className="mb-4 text-center text-xl font-bold">{t.listTitle}</h3>
            )}
            {sheetsLoading ? (
              <p className="text-center text-gray-400">{texts.common.loading}</p>
            ) : sheets.length === 0 ? (
              <p className="text-center text-gray-500">{t.listEmpty}</p>
            ) : (
              <div className="space-y-3">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    onClick={() => loadDetail(sheet.id)}
                    className="w-full rounded-xl bg-gray-900/80 p-4 text-left transition hover:bg-gray-800 active:scale-[0.98]"
                    style={{ minHeight: '64px' }}
                    disabled={detailLoading}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {sheet.worker.firstName} {sheet.worker.lastName}
                        </p>
                        <p className="text-sm text-gray-400">
                          {t.week} {sheet.weekNumber}/{sheet.weekYear}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-medium text-blue-400">
                          {formatMinutes(sheet.totalMinutesNet)}
                        </p>
                        <span className="inline-block rounded-full bg-yellow-600/30 px-2 py-0.5 text-xs font-medium text-yellow-300">
                          {tTimesheets.status[sheet.status] ?? sheet.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                resetActivity();
                loadSheets();
              }}
              className="mx-auto mt-6 block rounded-lg bg-gray-800 px-6 py-3 text-gray-300 transition hover:bg-gray-700"
              style={{ minHeight: '44px' }}
            >
              {texts.customerPl.timesheets.reload}
            </button>
          </>
        )}
      </div>

      <PlAutoLogoutBanner countdown={countdown} message={t.autoLogout} />
    </div>
  );
}
