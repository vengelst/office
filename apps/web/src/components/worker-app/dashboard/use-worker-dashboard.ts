'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  clearWorkerSession,
  getStoredWorker,
  getWorkerToken,
  workerApi,
  type ClockStatus,
  type TodayEntry,
  type WorkerMe,
  type WorkerMeAssignment,
} from '@/lib/timesheets';
import {
  activityTypesApi,
  type ActivityTypeItem,
} from '@/lib/activity-types';
import {
  getOptimisticClockStatus,
  startOfflineClockSync,
} from '@/lib/offline-clock-queue';
import { texts } from '@/lib/texts';
import { usePeriodicGpsPing } from '@/lib/use-periodic-gps-ping';
import {
  appendGpsToFormData,
  recordWorkerGps,
} from '@/lib/record-worker-gps';
import { dayStart, getGeo } from './helpers';

export function useWorkerDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.workerApp;

  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [today, setToday] = useState<TodayEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activityTypes, setActivityTypes] = useState<ActivityTypeItem[]>([]);
  const [selectedActivityTypeId, setSelectedActivityTypeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [, setTick] = useState(0);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoComment, setPhotoComment] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  usePeriodicGpsPing({
    active: Boolean(status?.clockedIn && worker?.id),
    workerId: worker?.id,
    projectId: status?.project?.id ?? selectedProjectId ?? null,
  });

  useEffect(() => {
    if (!getWorkerToken()) {
      router.replace('/worker-app');
      return;
    }
    setWorker(getStoredWorker());
  }, [router]);

  const refresh = useCallback(async (workerId: string) => {
    try {
      const [me, st, td] = await Promise.all([
        workerApi.me(),
        workerApi.status(workerId),
        workerApi.today(workerId),
      ]);
      setWorker(me);
      const merged = await getOptimisticClockStatus(workerId, st);
      setStatus(merged);
      setToday(td);
    } catch {
      const merged = await getOptimisticClockStatus(workerId, null);
      setStatus(merged);
    }
  }, []);

  useEffect(() => {
    const w = getStoredWorker();
    if (!w) return;
    startOfflineClockSync();
    void refresh(w.id).catch(() => {});
    void getGeo().then((g) => setGpsOk(g !== null));
  }, [refresh]);

  useEffect(() => {
    if (!worker?.masterEngineer) {
      setActivityTypes([]);
      setSelectedActivityTypeId('');
      return;
    }
    void activityTypesApi
      .listActiveForWorker()
      .then((list) => {
        setActivityTypes(list);
        setSelectedActivityTypeId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev;
          const fromStatus = status?.currentActivity?.id;
          if (fromStatus && list.some((a) => a.id === fromStatus)) {
            return fromStatus;
          }
          return list[0]?.id ?? '';
        });
      })
      .catch(() => setActivityTypes([]));
  }, [worker?.masterEngineer, worker?.id, status?.currentActivity?.id]);

  useEffect(() => {
    if (!status?.clockedIn) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status?.clockedIn]);

  const { current, future } = useMemo(() => {
    const todayMs = dayStart(new Date());
    const cur: WorkerMeAssignment[] = [];
    const fut: WorkerMeAssignment[] = [];
    for (const a of worker?.assignments ?? []) {
      const start = dayStart(new Date(a.startDate));
      const end = a.endDate ? dayStart(new Date(a.endDate)) : null;
      if (start > todayMs) fut.push(a);
      else if (end === null || end >= todayMs) cur.push(a);
    }
    return { current: cur, future: fut };
  }, [worker]);

  useEffect(() => {
    if (!selectedProjectId && current.length > 0) {
      setSelectedProjectId(current[0].project.id);
    }
  }, [current, selectedProjectId]);

  const elapsedSeconds = status?.clockedIn && status.since
    ? Math.floor((Date.now() - new Date(status.since).getTime()) / 1000)
    : 0;

  const handleClockIn = async (): Promise<void> => {
    if (!worker) return;
    const projectId = status?.clockedIn
      ? status.project?.id
      : selectedProjectId;
    if (!projectId) {
      toast({ description: t.toast.noProject });
      return;
    }
    if (worker.masterEngineer && !selectedActivityTypeId) {
      toast({ description: t.toast.noActivity });
      return;
    }
    const assignment = (worker.assignments ?? []).find(
      (a) => a.project.id === projectId,
    );
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      const result = await workerApi.clockIn({
        workerId: worker.id,
        projectId,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        activityTypeId: worker.masterEngineer
          ? selectedActivityTypeId
          : undefined,
        projectSnapshot: assignment
          ? {
              id: assignment.project.id,
              projectNumber: assignment.project.projectNumber,
              title: assignment.project.title,
            }
          : status?.project ?? null,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60);
      }
      setStatus(result);
      if (result.queued) {
        toast({ description: t.toast.savedPending });
      } else {
        await refresh(worker.id);
        toast({ description: t.toast.clockedIn });
      }
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchActivity = async (activityTypeId: string): Promise<void> => {
    if (!worker || !status?.clockedIn) return;
    if (activityTypeId === status.currentActivity?.id) return;
    setSelectedActivityTypeId(activityTypeId);
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      const next = await workerApi.switchActivity({
        workerId: worker.id,
        activityTypeId,
        ...geo,
        occurredAtClient: new Date().toISOString(),
      });
      setStatus(next);
      toast({ description: t.toast.activitySwitched });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async (): Promise<void> => {
    if (!worker) return;
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      const result = await workerApi.clockOut({
        workerId: worker.id,
        projectId: status?.project?.id,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 40, 40]);
      }
      setStatus(result);
      if (result.queued) {
        toast({ description: t.toast.savedPending });
      } else {
        await refresh(worker.id);
        toast({ description: t.toast.clockedOut });
      }
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBreakStart = async (): Promise<void> => {
    if (!worker) return;
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      const result = await workerApi.breakStart({
        workerId: worker.id,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      setStatus(result);
      if (result.queued) {
        toast({ description: t.toast.savedPending });
      } else {
        await refresh(worker.id);
        toast({ description: t.toast.breakStarted });
      }
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBreakEnd = async (): Promise<void> => {
    if (!worker) return;
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      const result = await workerApi.breakEnd({
        workerId: worker.id,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      setStatus(result);
      if (result.queued) {
        toast({ description: t.toast.savedPending });
      } else {
        await refresh(worker.id);
        toast({ description: t.toast.breakEnded });
      }
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (opts?: {
    comment: string;
    xNorm?: number | null;
    yNorm?: number | null;
  }): Promise<void> => {
    if (!worker || !photoFile) return;
    const projectId = status?.clockedIn
      ? status.project?.id
      : selectedProjectId;
    if (!projectId) {
      toast({ description: t.toast.noProject });
      return;
    }
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append('file', photoFile);
      form.append('workerId', worker.id);
      form.append('projectId', projectId);
      const comment = (opts?.comment ?? photoComment).trim();
      if (comment) form.append('comment', comment);
      if (opts?.xNorm != null && opts?.yNorm != null) {
        form.append('commentX', String(opts.xNorm));
        form.append('commentY', String(opts.yNorm));
      }
      await appendGpsToFormData(form);
      await workerApi.uploadPhoto(form);
      toast({ description: t.toast.photoUploaded });
      setPhotoOpen(false);
      setPhotoFile(null);
      setPhotoComment('');
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleLogout = (): void => {
    const projectId = status?.project?.id ?? selectedProjectId;
    const wid = worker?.id;
    void (async () => {
      if (wid) {
        await recordWorkerGps({
          workerId: wid,
          eventType: 'LOGOUT',
          projectId,
          timeoutMs: 5000,
        });
      }
      void workerApi.logout().catch(() => {});
      clearWorkerSession();
      router.replace('/worker-app');
    })();
  };

  const clockedIn = status?.clockedIn ?? false;
  const onBreak = status?.onBreak ?? false;
  const activeProject = clockedIn ? status?.project : null;

  const itemBasedActive =
    clockedIn &&
    !!activeProject &&
    (worker?.assignments ?? []).some(
      (a) => a.project.id === activeProject.id && a.project.itemBased === true,
    );

  return {
    router,
    t,
    worker,
    status,
    today,
    selectedProjectId,
    setSelectedProjectId,
    activityTypes,
    selectedActivityTypeId,
    setSelectedActivityTypeId,
    busy,
    gpsOk,
    photoOpen,
    setPhotoOpen,
    photoComment,
    setPhotoComment,
    photoFile,
    setPhotoFile,
    photoBusy,
    photoInput,
    current,
    future,
    elapsedSeconds,
    clockedIn,
    onBreak,
    activeProject,
    itemBasedActive,
    refresh,
    handleClockIn,
    handleSwitchActivity,
    handleClockOut,
    handleBreakStart,
    handleBreakEnd,
    handlePhotoUpload,
    handleLogout,
  };
}

export type WorkerDashboardState = ReturnType<typeof useWorkerDashboard>;
