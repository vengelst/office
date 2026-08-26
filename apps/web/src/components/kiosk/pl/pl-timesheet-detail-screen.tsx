'use client';

import { useRef, type RefObject } from 'react';
import { texts } from '@/lib/texts';
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from '@/components/timesheets/signature-canvas';
import {
  formatDate,
  formatMinutes,
  formatTime,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { PlAutoLogoutBanner } from './pl-auto-logout-banner';
import { weekdayLabel } from './helpers';

interface PlTimesheetDetailScreenProps {
  detail: TimesheetDetail;
  timeStr: string;
  signerName: string;
  signing: boolean;
  signError: string;
  countdown: number;
  onPointerDown: () => void;
  resetActivity: () => void;
  onBack: () => void;
  onSignerNameChange: (name: string) => void;
  onSignAndApprove: (canvasRef: RefObject<SignatureCanvasHandle | null>) => void;
}

export function PlTimesheetDetailScreen({
  detail,
  timeStr,
  signerName,
  signing,
  signError,
  countdown,
  onPointerDown,
  resetActivity,
  onBack,
  onSignerNameChange,
  onSignAndApprove,
}: PlTimesheetDetailScreenProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const t = texts.kiosk.pl;
  const tTimesheets = texts.timesheets;

  const canApprove = detail.status === 'SUBMITTED';
  const hasCustomerSig = detail.signatures.some((s) => s.signerType === 'CUSTOMER');

  return (
    <div
      className="flex min-h-screen flex-col p-4"
      onClick={resetActivity}
      onTouchStart={resetActivity}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
          style={{ minHeight: '44px' }}
        >
          ← {t.backToList}
        </button>
        <div className="text-right text-xl tabular-nums text-gray-400">{timeStr}</div>
      </div>

      <h2 className="mt-4 text-2xl font-bold">
        KW {detail.weekNumber}/{detail.weekYear} · {detail.worker.firstName}{' '}
        {detail.worker.lastName}
      </h2>
      <p className="text-gray-400">{detail.project.title}</p>

      <div className="mt-4 overflow-x-auto rounded-xl bg-gray-900/80">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-3 py-2">{tTimesheets.week.day}</th>
              <th className="px-3 py-2">{tTimesheets.week.date}</th>
              <th className="px-3 py-2">{tTimesheets.week.start}</th>
              <th className="px-3 py-2">{tTimesheets.week.end}</th>
              <th className="px-3 py-2 text-right">{tTimesheets.week.gross}</th>
              <th className="px-3 py-2 text-right">{tTimesheets.week.break}</th>
              <th className="px-3 py-2 text-right">{tTimesheets.week.net}</th>
            </tr>
          </thead>
          <tbody>
            {detail.days.map((day) => (
              <tr key={day.id} className="border-b border-gray-800">
                <td className="px-3 py-2 font-medium">{weekdayLabel(day.workDate)}</td>
                <td className="px-3 py-2">{formatDate(day.workDate)}</td>
                <td className="px-3 py-2 font-mono">{formatTime(day.firstClockInAt)}</td>
                <td className="px-3 py-2 font-mono">{formatTime(day.lastClockOutAt)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatMinutes(day.grossMinutes)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatMinutes(day.breakMinutes)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium">
                  {formatMinutes(day.netMinutes)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-600 font-bold">
              <td colSpan={4} className="px-3 py-2">
                {t.totals}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatMinutes(detail.totalMinutesGross)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatMinutes(detail.totalBreakMinutes)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatMinutes(detail.totalMinutesNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {detail.signatures.length > 0 && (
        <div className="mt-4 rounded-xl bg-gray-900/60 p-3">
          <h4 className="mb-2 text-sm font-medium text-gray-400">
            {tTimesheets.signatures.existing}
          </h4>
          {detail.signatures.map((sig) => (
            <p key={sig.id} className="text-sm text-gray-300">
              {tTimesheets.signerType[sig.signerType]}: {sig.signerName} ·{' '}
              {formatDate(sig.signedAt)}
            </p>
          ))}
        </div>
      )}

      {canApprove && !hasCustomerSig ? (
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">{t.signerName}</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-lg text-white"
              style={{ minHeight: '44px' }}
            />
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-400">{t.signatureHint}</p>
            <SignatureCanvas
              ref={canvasRef}
              height={160}
              className="border-gray-600 bg-gray-100"
            />
            <button
              onClick={() => canvasRef.current?.clear()}
              className="mt-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
              style={{ minHeight: '44px' }}
            >
              {t.clearSignature}
            </button>
          </div>

          {signError && <p className="text-red-400">{signError}</p>}

          <button
            onClick={() => onSignAndApprove(canvasRef)}
            disabled={signing || !signerName.trim()}
            className="w-full rounded-2xl bg-green-600 px-8 py-6 text-2xl font-bold text-white shadow-lg shadow-green-900/50 transition hover:bg-green-500 active:scale-95 disabled:opacity-60"
            style={{ minHeight: '80px' }}
          >
            {signing ? t.signing : t.signAndApprove}
          </button>
        </div>
      ) : hasCustomerSig ? (
        <p className="mt-6 text-center text-lg text-green-400">✅ {t.alreadySigned}</p>
      ) : null}

      <PlAutoLogoutBanner countdown={countdown} message={t.autoLogout} />
    </div>
  );
}
