'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { texts } from '@/lib/texts';
import { formatDateTime } from '@/lib/format';
import { kioskPlApi } from '@/lib/kiosk-pl-api';
import {
  WORK_ITEM_REPORT_LABELS,
  WORK_ITEM_REVIEW_LABELS,
  WORK_ITEM_STATUS_LABELS,
  type WorkItemDetail,
  type WorkItemStatus,
} from '@/lib/work-items';

/**
 * Vollbild-Item-Detail am Kiosk: Metadaten, Fotos, Approve / Force-Complete.
 * Fotos über Kiosk-Token-Stream (`kioskPlApi.photoObjectUrl`).
 */
export function KioskPlItemDetail({
  itemId,
  onClose,
  onChanged,
  onActivity,
}: {
  itemId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
  onActivity: () => void;
}): ReactNode {
  const t = texts.customerPl.detail;
  const a = texts.customerPl.actions;
  const tItems = texts.kiosk.pl.items;

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setComment('');
    setActionError('');
    kioskPlApi
      .workItem(itemId)
      .then(setItem)
      .catch((err: unknown) => {
        setItem(null);
        setError(err instanceof Error ? err.message : tItems.detailError);
      })
      .finally(() => setLoading(false));
  }, [itemId, tItems.detailError]);

  const runReview = useCallback(
    async (action: 'approve' | 'forceComplete') => {
      onActivity();
      setBusy(true);
      setActionError('');
      try {
        const trimmed = comment.trim();
        if (action === 'approve') {
          await kioskPlApi.approve(itemId, trimmed || undefined);
          onChanged(texts.customerPl.toast.approved);
        } else {
          await kioskPlApi.forceComplete(itemId, trimmed || undefined);
          onChanged(texts.customerPl.toast.forceCompleted);
        }
      } catch (err: unknown) {
        setActionError(
          err instanceof Error ? err.message : texts.customerPl.toast.error,
        );
      } finally {
        setBusy(false);
      }
    },
    [itemId, comment, onActivity, onChanged],
  );

  const canApprove = item?.status === 'REVIEW';
  const isApproved = item?.status === 'APPROVED';

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-gray-950 p-4"
      onClick={onActivity}
      onTouchStart={onActivity}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
          style={{ minHeight: '44px' }}
        >
          ← {tItems.closeDetail}
        </button>
      </div>

      {loading && (
        <p className="mt-8 text-center text-gray-400">{texts.common.loading}</p>
      )}

      {error && !loading && (
        <p className="mt-8 text-center text-red-400">{error}</p>
      )}

      {item && (
        <div className="mx-auto mt-4 w-full max-w-3xl space-y-6 pb-10">
          <div>
            <h2 className="font-mono text-2xl font-bold">{item.itemKey}</h2>
            <p className="text-lg text-gray-300">{item.title ?? '–'}</p>
            <div className="mt-2">
              <StatusChip status={item.status} />
            </div>
          </div>

          {/* Prüf-Aktionen */}
          <section className="space-y-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
            <h3 className="text-lg font-semibold">{a.title}</h3>
            {isApproved ? (
              <p className="text-green-400">✅ {a.alreadyApproved}</p>
            ) : (
              <>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={a.commentPlaceholder}
                  aria-label={a.comment}
                  rows={2}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={!canApprove || busy}
                    onClick={() => void runReview('approve')}
                    className="flex-1 rounded-2xl bg-green-600 px-6 py-4 text-xl font-bold text-white transition hover:bg-green-500 active:scale-95 disabled:opacity-40"
                    style={{ minHeight: '56px' }}
                  >
                    {busy ? a.approving : a.approve}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      onActivity();
                      setForceOpen(true);
                    }}
                    className="flex-1 rounded-2xl bg-amber-600 px-6 py-4 text-xl font-bold text-white transition hover:bg-amber-500 active:scale-95 disabled:opacity-40"
                    style={{ minHeight: '56px' }}
                  >
                    {a.forceComplete}
                  </button>
                </div>
                {!canApprove && (
                  <p className="text-sm text-gray-500">{a.approveOnlyInReview}</p>
                )}
                {item.status === 'REWORK' && (
                  <p className="text-sm text-gray-500">{t.reworkHint}</p>
                )}
                {actionError && (
                  <p className="text-red-400">{actionError}</p>
                )}
              </>
            )}
          </section>

          {/* Angaben */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.metadata}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Meta label={t.floor} value={item.floor} />
              <Meta label={t.area} value={item.area} />
              <Meta label={t.room} value={item.room} />
              <Meta label={t.type} value={item.type} />
              <Meta label={t.rc} value={item.rc} />
              <Meta label={t.detailField} value={item.detail} />
              <Meta label={t.planPage} value={item.planPage} />
              <Meta label={t.pdfFile} value={item.pdfFile} />
              <Meta label={t.pdfPage} value={item.pdfPage} />
            </div>
            <Meta label={t.workScope} value={item.workScopeDe} />
            {item.workScopeSk && (
              <Meta label={`${t.workScope} (SK)`} value={item.workScopeSk} />
            )}
          </section>

          {/* Material */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.materials}</h3>
            {item.materials.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noMaterials}</p>
            ) : (
              <ul className="space-y-1">
                {item.materials.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-lg bg-gray-900/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-gray-400">
                      {[line.qty, line.qtyUnit].filter(Boolean).join(' ') || '–'}
                    </span>
                    <span className="ml-2">{line.materialDe}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Monteure */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.assignments}</h3>
            {item.assignments.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noAssignments}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {item.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    {assignment.worker.lastName}, {assignment.worker.firstName}{' '}
                    <span className="text-gray-500">
                      · {t.since} {formatDateTime(assignment.startedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rückmeldungen inkl. Fotos */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.reports}</h3>
            {item.reports.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noReports}</p>
            ) : (
              <ul className="space-y-3">
                {item.reports.map((report) => (
                  <li
                    key={report.id}
                    className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm"
                  >
                    <p className="font-medium">
                      {WORK_ITEM_REPORT_LABELS[report.type]}
                      <span className="ml-2 font-normal text-gray-400">
                        {report.worker.lastName}, {report.worker.firstName} ·{' '}
                        {formatDateTime(report.reportedAt)}
                      </span>
                    </p>
                    {report.comment && (
                      <p className="mt-1 text-gray-300">{report.comment}</p>
                    )}
                    {report.photoDocumentIds.length > 0 && (
                      <>
                        <p className="mt-3 text-xs text-gray-500">{t.photos}</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {report.photoDocumentIds.map((docId, index) => (
                            <ReportPhoto
                              key={docId}
                              itemId={item.id}
                              documentId={docId}
                              index={index}
                              onActivity={onActivity}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Kontrollen */}
          <section className="space-y-2">
            <h3 className="text-lg font-semibold">{t.reviews}</h3>
            {item.reviews.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noReviews}</p>
            ) : (
              <ul className="space-y-2">
                {item.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-sm"
                  >
                    <p className="font-medium">
                      {WORK_ITEM_REVIEW_LABELS[review.action]}
                      <span className="ml-2 font-normal text-gray-400">
                        {review.reviewer?.displayName ?? '–'} ·{' '}
                        {formatDateTime(review.reviewedAt)}
                      </span>
                    </p>
                    {review.comment && (
                      <p className="mt-1 text-gray-300">{review.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Force-Complete Confirm */}
      {forceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-gray-900 p-6">
            <h3 className="text-xl font-bold">
              {texts.customerPl.forceCompleteDialog.title}
            </h3>
            <p className="text-gray-300">
              {texts.customerPl.forceCompleteDialog.description}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onActivity();
                  setForceOpen(false);
                }}
                className="flex-1 rounded-xl bg-gray-700 py-3 text-gray-200"
                style={{ minHeight: '44px' }}
              >
                {texts.customers.actions.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForceOpen(false);
                  void runReview('forceComplete');
                }}
                className="flex-1 rounded-xl bg-amber-600 py-3 font-bold text-white"
                style={{ minHeight: '44px' }}
              >
                {texts.customerPl.forceCompleteDialog.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): ReactNode {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-200">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: WorkItemStatus }): ReactNode {
  const styles: Record<WorkItemStatus, string> = {
    OPEN: 'bg-gray-600 text-gray-100',
    IN_PROGRESS: 'bg-blue-600 text-white',
    REVIEW: 'bg-amber-500 text-black',
    REWORK: 'bg-red-600 text-white',
    APPROVED: 'bg-green-600 text-white',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {WORK_ITEM_STATUS_LABELS[status]}
    </span>
  );
}

/** Foto der Fertigmeldung per Kiosk-Token-Stream. */
function ReportPhoto({
  itemId,
  documentId,
  index,
  onActivity,
}: {
  itemId: string;
  documentId: string;
  index: number;
  onActivity: () => void;
}): ReactNode {
  const t = texts.customerPl.detail;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    kioskPlApi
      .photoObjectUrl(itemId, documentId)
      .then((value) => {
        objectUrl = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId, documentId]);

  if (failed) {
    return <p className="text-xs text-gray-500">{t.photoError}</p>;
  }
  if (!url) {
    return (
      <div className="h-28 w-28 animate-pulse rounded-lg bg-gray-800" />
    );
  }

  return (
    <>
      <button
        type="button"
        className="overflow-hidden rounded-lg border border-gray-600"
        onClick={() => {
          onActivity();
          setLightbox(true);
        }}
        aria-label={`${t.photo} ${index + 1}`}
        title={t.openPhoto}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${t.photo} ${index + 1}`}
          className="h-28 w-28 object-cover"
        />
      </button>
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => {
            onActivity();
            setLightbox(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${t.photo} ${index + 1}`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
