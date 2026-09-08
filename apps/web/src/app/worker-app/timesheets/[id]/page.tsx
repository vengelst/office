'use client';

/**
 * Stundenzettel-Detail in der Monteur-App: Tagesübersicht (read-only) + Signatur.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from '@/components/timesheets/signature-canvas';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import {
  formatDate,
  formatHours,
  formatMinutes,
  formatTime,
  workerApi,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { useWorkerSessionGuard } from '../../use-worker-session-guard';

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function weekdayLabel(iso: string): string {
  return texts.timesheets.days[DAY_KEYS[new Date(iso).getDay()]];
}

function canSign(sheet: TimesheetDetail): boolean {
  return sheet.status === 'DRAFT' || sheet.status === 'REJECTED';
}

export default function WorkerTimesheetDetailPage(): ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const worker = useWorkerSessionGuard();
  const t = texts.workerApp.timesheets;
  const canvasRef = useRef<SignatureCanvasHandle>(null);

  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const detail = await workerApi.getTimesheet(id);
      setSheet(detail);
      setSignerName(
        `${detail.worker.firstName} ${detail.worker.lastName}`.trim(),
      );
    } catch (err) {
      setSheet(null);
      setError(err instanceof ApiError ? err.message : t.notFound);
    } finally {
      setLoading(false);
    }
  }, [id, t.notFound]);

  useEffect(() => {
    if (!worker) return;
    void load();
  }, [worker, load]);

  useEffect(() => {
    const sync = () =>
      setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const handleSign = async (): Promise<void> => {
    if (offline) {
      setToast(t.offlineHint);
      return;
    }
    if (!signerName.trim()) {
      setToast(t.needName);
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL();
    if (!dataUrl) {
      setToast(t.needSignature);
      return;
    }
    setBusy(true);
    setToast('');
    try {
      const updated = await workerApi.signTimesheet(id, {
        signerType: 'WORKER',
        signerName: signerName.trim(),
        signatureBase64: dataUrl,
      });
      setSheet(updated);
      setToast(t.toastSigned);
      canvasRef.current?.clear();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : t.toastError);
    } finally {
      setBusy(false);
    }
  };

  if (!worker) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        {texts.common.loading}
      </p>
    );
  }

  if (loading) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        {texts.common.loading}
      </p>
    );
  }

  if (!sheet) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <button
          type="button"
          onClick={() => router.push('/worker-app/timesheets')}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.back}
        </button>
        <p className="text-center text-sm text-destructive">{error || t.notFound}</p>
      </div>
    );
  }

  const signable = canSign(sheet);
  const hasWorkerSig = sheet.signatures.some((s) => s.signerType === 'WORKER');
  const locked =
    sheet.status === 'WORKER_SIGNED' ||
    sheet.status === 'SUBMITTED' ||
    sheet.status === 'APPROVED' ||
    sheet.status === 'ARCHIVED';

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      <button
        type="button"
        onClick={() => router.push('/worker-app/timesheets')}
        className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </button>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">
            {t.week} {sheet.weekNumber}/{sheet.weekYear}
          </h1>
          <TimesheetStatusBadge status={sheet.status} />
        </div>
        <p className="text-sm text-muted-foreground">{sheet.project.title}</p>
        <p className="text-xs text-muted-foreground">
          {t.net}: {formatHours(sheet.totalMinutesNet)}
        </p>
      </div>

      {offline && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {t.offlineHint}
        </p>
      )}

      {locked && (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {t.lockedHint}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t.daysTitle}</h2>
        {sheet.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noDays}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {sheet.days.map((day) => (
              <li key={day.id} className="flex items-start justify-between gap-3 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {weekdayLabel(day.workDate)} · {formatDate(day.workDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {day.firstClockInAt
                      ? formatTime(day.firstClockInAt)
                      : '–'}{' '}
                    –{' '}
                    {day.lastClockOutAt
                      ? formatTime(day.lastClockOutAt)
                      : '–'}
                  </p>
                </div>
                <p className="text-sm font-mono tabular-nums">
                  {formatMinutes(day.netMinutes)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasWorkerSig && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t.alreadySigned}
        </p>
      )}

      {signable && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-base font-semibold">{t.signTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.signHint}</p>
          <div className="space-y-1.5">
            <Label htmlFor="signer-name">{t.signerName}</Label>
            <Input
              id="signer-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <SignatureCanvas ref={canvasRef} height={180} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => canvasRef.current?.clear()}
              disabled={busy}
            >
              {t.clear}
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              onClick={() => void handleSign()}
              disabled={busy || offline}
            >
              {busy ? t.saving : t.save}
            </Button>
          </div>
        </section>
      )}

      {toast && (
        <p className="text-center text-sm text-muted-foreground">{toast}</p>
      )}
    </div>
  );
}
