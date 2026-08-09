/**
 * Komponente: worker-work-items / work-item-detail (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

/**
 * Item-Detail des Monteurs im Browser (SPEZ-arbeitsitems.md 4.1, 5, 6, 8.2).
 *
 * Nachbau von `apps/mobile/app/(app)/work-items/[id].tsx` – gleiche Daten,
 * gleiche Aktionen, gleiche Guards:
 *   Nehmen · Als aktuell setzen (Item-Zeit) · Fertig (≥2 Fotos) · Nacharbeit
 *
 * Guards:
 *   - „Als aktuell setzen“ nur wenn am Projekt eingestempelt (Item-Zeit läuft
 *     laut SPEZ 8.2 nur bei gestempeltem Monteur).
 *   - Fertigmeldung erst ab 2 Fotos (die API weist weniger mit 400 ab).
 *   - REVIEW/APPROVED sind read-only.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Hand,
  Hourglass,
  Pause,
  Play,
  RotateCw,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { both, PDF_ERRORS, T } from '@/lib/i18n-work-items';
import { formatTime, workerApi, type ClockStatus } from '@/lib/timesheets';
import {
  apiMessage,
  formatDateTime,
  loadWorkItemPdf,
  workerWorkItemsApi,
  WorkItemPdfError,
  type WorkItemDetail as WorkItemDetailData,
  type WorkItemPdfBlob,
} from '@/lib/worker-work-items';
import { CompleteReworkDialog, type ReportMode } from './complete-rework-dialog';
import { MaterialTable } from './material-table';
import { StatusBadge } from './status-badge';

export interface WorkItemDetailProps {
  itemId: string;
  /** ID des angemeldeten Monteurs (Zuordnung + Stempel-Status). */
  workerId: string;
  /** Zurück zur Liste. */
  onBack: () => void;
  /** Kiosk: jede Nutzeraktion verlängert den Auto-Logout. */
  onActivity?: () => void;
}

/**
 * UI-Komponente `WorkItemDetail`.
 */
export function WorkItemDetail({
  itemId,
  workerId,
  onBack,
  onActivity,
}: WorkItemDetailProps): ReactNode {
  const [item, setItem] = useState<WorkItemDetailData | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const [pdf, setPdf] = useState<WorkItemPdfBlob | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [reportMode, setReportMode] = useState<ReportMode | null>(null);
  const [sending, setSending] = useState(false);

  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, status] = await Promise.all([
        workerWorkItemsApi.one(itemId),
        workerApi.status(workerId),
      ]);
      setItem(detail);
      setClock(status);
      setError('');
    } catch (err) {
      setError(apiMessage(err, both(T.loadFailed)));
    }
  }, [itemId, workerId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Blob-URL des PDFs und ein laufender Rücksprung-Timer beim Verlassen aufräumen.
  const pdfRef = useRef<WorkItemPdfBlob | null>(null);
  pdfRef.current = pdf;
  useEffect(
    () => () => {
      if (pdfRef.current) URL.revokeObjectURL(pdfRef.current.url);
      if (backTimer.current) clearTimeout(backTimer.current);
    },
    [],
  );

  /** Aktive Zuordnung des angemeldeten Monteurs an diesem Item. */
  const assignedToMe = (item?.assignments ?? []).some(
    (a) => a.worker.id === workerId,
  );

  /** Laufende eigene Session an diesem Item = „aktuelles Item“. */
  const runningSession =
    (item?.sessions ?? []).find(
      (s) => s.endedAt === null && s.worker.id === workerId,
    ) ?? null;

  /** Am Projekt dieses Items eingestempelt (Voraussetzung für Item-Zeit). */
  const clockedInHere =
    (clock?.clockedIn ?? false) && clock?.project?.id === item?.projectId;

  // ── Aktionen ─────────────────────────────────────────────────

  const runAction = async (
    fn: () => Promise<unknown>,
    successMessage?: string,
  ): Promise<void> => {
    onActivity?.();
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      if (successMessage) setFlash(successMessage);
    } catch (err) {
      setError(apiMessage(err, both(T.loadFailed)));
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = (): void => {
    void runAction(() => workerWorkItemsApi.claim(itemId), both(T.claimed));
  };

  const handleStartSession = (): void => {
    if (!clockedInHere) {
      setError(
        `${both(T.clockInFirst)}: ${T.clockInFirstHint.de} / ${T.clockInFirstHint.sk}`,
      );
      return;
    }
    void runAction(() => workerWorkItemsApi.startSession(itemId));
  };

  const handleStopSession = (): void => {
    void runAction(() => workerWorkItemsApi.stopSession(itemId));
  };

  /** Block-PDF laden und im Overlay zeigen (SPEZ 6.5 „Unterlage öffnen“). */
  const handleOpenPdf = async (): Promise<void> => {
    if (!item || pdfBusy) return;
    onActivity?.();
    setPdfBusy(true);
    setError('');
    try {
      const loaded = await loadWorkItemPdf(item);
      setPdf(loaded);
    } catch (err) {
      const reason = err instanceof WorkItemPdfError ? err.reason : 'download';
      setError(both(PDF_ERRORS[reason]));
    } finally {
      setPdfBusy(false);
    }
  };

  const closePdf = (): void => {
    onActivity?.();
    setPdf((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const submitReport = async (photos: File[], comment: string): Promise<void> => {
    if (!reportMode) return;
    onActivity?.();
    setSending(true);
    setError('');
    try {
      if (reportMode === 'complete') {
        await workerWorkItemsApi.complete(itemId, photos, comment);
      } else {
        await workerWorkItemsApi.rework(itemId, photos, comment);
      }
      setFlash(
        reportMode === 'complete' ? both(T.completeSent) : both(T.reworkSent),
      );
      setReportMode(null);
      await load();
      // Wie in der APK: nach der Meldung zurück in die Liste.
      backTimer.current = setTimeout(onBack, 1600);
    } catch (err) {
      setError(apiMessage(err, both(T.loadFailed)));
    } finally {
      setSending(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <Shell title={both(T.workItems)} onBack={onBack}>
        <p className="py-10 text-center text-sm text-gray-500">
          {both(T.loading)}
        </p>
      </Shell>
    );
  }

  if (!item) {
    return (
      <Shell title={both(T.workItems)} onBack={onBack}>
        <p className="py-10 text-center text-sm text-gray-500">
          {error || both(T.loadFailed)}
        </p>
      </Shell>
    );
  }

  // REVIEW/APPROVED sind für den Monteur read-only; sonst gilt: wer das Item
  // (noch) nicht hat, kann es nehmen – auch als zusätzlicher Monteur (SPEZ 5.2).
  const readOnly = item.status === 'REVIEW' || item.status === 'APPROVED';
  const claimable = !assignedToMe;
  const planLine = [
    item.block ? `${T.block.de}/${T.block.sk} ${item.block.blockKey}` : null,
    item.pdfFile,
    item.pdfPage != null ? `${T.page.de}/${T.page.sk} ${item.pdfPage}` : null,
    item.planPage != null && item.pdfPage == null
      ? `${T.plan.de}/${T.plan.sk} ${item.planPage}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Shell
      title={item.itemKey}
      mono
      onBack={onBack}
      onRefresh={() => {
        onActivity?.();
        void load();
      }}
    >
      <div className="space-y-3">
        {error && (
          <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {flash && (
          <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {flash}
          </p>
        )}

        {/* Kopf */}
        <section className="rounded-2xl bg-gray-900 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            {runningSession && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <Play className="h-3.5 w-3.5" />
                {both(T.isCurrent)} · {formatTime(runningSession.startedAt)}
              </span>
            )}
          </div>

          {item.title && (
            <h2 className="mt-2.5 text-lg font-semibold text-gray-50">
              {item.title}
            </h2>
          )}

          <dl className="mt-3 flex flex-wrap gap-4">
            <Meta label={T.floor.de} labelSk={T.floor.sk} value={item.floor} />
            <Meta label={T.area.de} labelSk={T.area.sk} value={item.area} />
            <Meta label={T.room.de} labelSk={T.room.sk} value={item.room} />
            <Meta label={T.type.de} labelSk={T.type.sk} value={item.type} />
            <Meta label={T.rc.de} labelSk={T.rc.sk} value={item.rc} />
          </dl>

          {item.detail && (
            <p className="mt-3 text-sm text-gray-300">{item.detail}</p>
          )}

          {/* Unterlage: Planreferenz + PDF-Button */}
          {(planLine.length > 0 || item.hasPdf) && (
            <div className="mt-3 space-y-2.5 border-t border-gray-800 pt-3">
              {planLine.length > 0 && (
                <p className="flex items-center gap-1.5 text-[13px] text-gray-400">
                  <FileText className="h-4 w-4 shrink-0" />
                  {planLine}
                </p>
              )}
              {item.hasPdf && (
                <button
                  type="button"
                  onClick={() => void handleOpenPdf()}
                  disabled={pdfBusy}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-blue-500/35 bg-gray-800 px-4 text-[15px] font-semibold text-gray-50 transition active:scale-[0.99] disabled:opacity-70"
                >
                  <FileText className="h-5 w-5" />
                  {pdfBusy ? both(T.openingPdf) : both(T.openPdf)}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Arbeitsumfang DE + SK */}
        {(item.workScopeDe || item.workScopeSk) && (
          <section className="rounded-2xl bg-gray-900 p-4">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {both(T.workScope)}
            </h3>
            {item.workScopeDe && (
              <p className="whitespace-pre-line text-[15px] leading-6 text-gray-50">
                {item.workScopeDe}
              </p>
            )}
            {item.workScopeSk && (
              <p className="mt-1.5 whitespace-pre-line text-[15px] italic leading-6 text-gray-400">
                {item.workScopeSk}
              </p>
            )}
          </section>
        )}

        {/* Material DE + SK */}
        <MaterialTable materials={item.materials} />

        {/* Rückmeldungen */}
        {item.reports.length > 0 && (
          <section className="rounded-2xl bg-gray-900 p-4">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {both(T.reports)}
            </h3>
            <ul className="divide-y divide-gray-800">
              {item.reports.map((report) => (
                <li key={report.id} className="py-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-50">
                    {report.type === 'COMPLETED' ? (
                      <CheckCheck className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Wrench className="h-4 w-4 text-amber-500" />
                    )}
                    {report.type === 'COMPLETED'
                      ? both(T.complete)
                      : both(T.rework)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDateTime(report.reportedAt)} · {both(T.byWorker)}{' '}
                    {report.worker.firstName} {report.worker.lastName} ·{' '}
                    {report.photoDocumentIds.length} {both(T.photos)}
                  </p>
                  {report.comment && (
                    <p className="mt-1 text-[13px] text-gray-300">
                      {report.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Kontrollen des Kunden-PLs (nur lesen) */}
        {item.reviews.length > 0 && (
          <section className="rounded-2xl bg-gray-900 p-4">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              {both(T.reviews)}
            </h3>
            <ul className="divide-y divide-gray-800">
              {item.reviews.map((review) => (
                <li key={review.id} className="py-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-50">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    {review.action === 'APPROVE'
                      ? both(T.approvedReview)
                      : both(T.forcedReview)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDateTime(review.reviewedAt)}
                    {review.reviewer
                      ? ` · ${both(T.byWorker)} ${review.reviewer.displayName}`
                      : ''}
                  </p>
                  {review.comment && (
                    <p className="mt-1 text-[13px] text-gray-300">
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Hinweise für read-only Stati */}
        {item.status === 'REVIEW' && (
          <p className="flex items-center gap-2 rounded-xl bg-gray-900 p-3.5 text-sm text-gray-300">
            <Hourglass className="h-[18px] w-[18px] text-yellow-400" />
            {both(T.waitingForReview)}
          </p>
        )}
        {item.status === 'APPROVED' && (
          <p className="flex items-center gap-2 rounded-xl bg-gray-900 p-3.5 text-sm text-gray-300">
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-400" />
            {both(T.approvedHint)}
          </p>
        )}

        {/* Aktionen */}
        {!readOnly && (
          <div className="space-y-2.5 pt-1">
            {claimable && (
              <ActionButton
                icon={<Hand className="h-[22px] w-[22px]" />}
                label={both(T.claim)}
                variant="primary"
                disabled={busy}
                onClick={handleClaim}
              />
            )}

            {assignedToMe && !runningSession && (
              <ActionButton
                icon={<Play className="h-[22px] w-[22px]" />}
                label={both(T.setCurrent)}
                variant={clockedInHere ? 'primary' : 'muted'}
                disabled={busy}
                onClick={handleStartSession}
              />
            )}

            {assignedToMe && runningSession && (
              <ActionButton
                icon={<Pause className="h-[22px] w-[22px]" />}
                label={both(T.stopTime)}
                variant="neutral"
                disabled={busy}
                onClick={handleStopSession}
              />
            )}

            {assignedToMe && (
              <>
                <ActionButton
                  icon={<CheckCheck className="h-[22px] w-[22px]" />}
                  label={both(T.complete)}
                  variant="success"
                  disabled={busy}
                  onClick={() => {
                    onActivity?.();
                    setReportMode('complete');
                  }}
                />
                <ActionButton
                  icon={<Wrench className="h-[22px] w-[22px]" />}
                  label={both(T.rework)}
                  variant="warn"
                  disabled={busy}
                  onClick={() => {
                    onActivity?.();
                    setReportMode('rework');
                  }}
                />
              </>
            )}

            {!assignedToMe && (
              <p className="text-center text-sm text-gray-500">
                {both(T.claimFirst)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Foto-Dialog für Fertig / Nacharbeit */}
      {reportMode && (
        <CompleteReworkDialog
          mode={reportMode}
          sending={sending}
          onCancel={() => {
            onActivity?.();
            setReportMode(null);
          }}
          onSubmit={(photos, comment) => void submitReport(photos, comment)}
          onActivity={onActivity}
        />
      )}

      {/* Block-PDF im Overlay (Blob, weil der Endpunkt ein Token verlangt) */}
      {pdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center gap-2 p-3">
            <a
              href={pdf.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => onActivity?.()}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              {both(T.openInNewTab)}
            </a>
            <button
              type="button"
              onClick={closePdf}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gray-800 px-4 text-sm font-medium text-gray-200"
            >
              <X className="h-4 w-4" />
              {both(T.close)}
            </button>
          </div>
          <iframe
            src={pdf.url}
            title={pdf.filename}
            className="min-h-0 flex-1 bg-gray-900"
          />
        </div>
      )}
    </Shell>
  );
}

/** Dunkler Rahmen mit Kopfzeile (Zurück, Titel, optional Neu laden). */
function Shell({
  title,
  mono,
  onBack,
  onRefresh,
  children,
}: {
  title: string;
  mono?: boolean;
  onBack: () => void;
  onRefresh?: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center gap-2 px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={both(T.back)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-50 transition hover:bg-gray-800"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1
          className={`flex-1 truncate text-xl font-bold ${mono ? 'font-mono' : ''}`}
        >
          {title}
        </h1>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            aria-label={both(T.refresh)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-800"
          >
            <RotateCw className="h-5 w-5" />
          </button>
        )}
      </header>
      <div className="flex-1 px-5 pb-10">{children}</div>
    </div>
  );
}

/** Ein Metadatenfeld (Label DE/SK + Wert); wird bei leerem Wert ausgelassen. */
function Meta({
  label,
  labelSk,
  value,
}: {
  label: string;
  labelSk: string;
  value: string | null;
}): ReactNode {
  if (!value) return null;
  return (
    <div className="min-w-[90px]">
      <dt className="text-[11px] text-gray-500">
        {label} / {labelSk}
      </dt>
      <dd className="mt-px text-[15px] font-medium text-gray-50">{value}</dd>
    </div>
  );
}

/** Farben der Aktions-Buttons – identisch zur APK. */
const VARIANTS = {
  primary: 'bg-blue-500',
  success: 'bg-green-500',
  warn: 'bg-amber-500',
  neutral: 'bg-gray-700',
  muted: 'bg-gray-800',
} as const;

/** Großflächiger Aktions-Button (Touch-Ziel ≥ 60 px). */
function ActionButton({
  icon,
  label,
  variant,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  variant: keyof typeof VARIANTS;
  disabled?: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl px-4 text-[17px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50 ${VARIANTS[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
