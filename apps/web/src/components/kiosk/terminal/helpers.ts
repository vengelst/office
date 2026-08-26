import type { WorkerMe } from '@/lib/timesheets';

export function dayStartMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Gültige aktive Zuweisung für das Kiosk-Projekt (heute), oder Master-Monteur. */
export function assignmentValidToday(
  worker: WorkerMe | null,
  projectId: string,
): boolean {
  if (!worker) return false;
  if (worker.masterEngineer) return true;
  const today = dayStartMs(new Date());
  return (worker.assignments ?? []).some((a) => {
    if (a.project.id !== projectId) return false;
    const start = dayStartMs(new Date(a.startDate));
    const end = a.endDate ? dayStartMs(new Date(a.endDate)) : null;
    return start <= today && (end === null || end >= today);
  });
}

export function tryVibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(200);
  }
}
