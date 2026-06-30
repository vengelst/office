'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  LogOut,
  MapPin,
  MapPinOff,
  Play,
  Square,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import {
  clearWorkerSession,
  formatDuration,
  formatTime,
  getStoredWorker,
  getWorkerToken,
  workerApi,
  type ClockStatus,
  type TodayEntry,
  type WorkerMe,
  type WorkerMeAssignment,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';

function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

interface Geo {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

/** Fragt die GPS-Position ab (Timeout 10s). Verweigerung blockiert nicht. */
function getGeo(): Promise<Geo | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  });
}

export default function WorkerDashboardPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.workerApp;

  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [today, setToday] = useState<TodayEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [, setTick] = useState(0);

  // Foto-Upload
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoComment, setPhotoComment] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  // Auth-Gate + Initialdaten
  useEffect(() => {
    if (!getWorkerToken()) {
      router.replace('/worker-app');
      return;
    }
    setWorker(getStoredWorker());
  }, [router]);

  const refresh = useCallback(async (workerId: string) => {
    const [me, st, td] = await Promise.all([
      workerApi.me(),
      workerApi.status(workerId),
      workerApi.today(workerId),
    ]);
    setWorker(me);
    setStatus(st);
    setToday(td);
  }, []);

  useEffect(() => {
    const w = getStoredWorker();
    if (!w) return;
    void refresh(w.id).catch(() => {});
    void getGeo().then((g) => setGpsOk(g !== null));
  }, [refresh]);

  // Sekunden-Timer, solange eingestempelt.
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

  // Default-Projektauswahl setzen.
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
    setBusy(true);
    try {
      const geo = await getGeo();
      setGpsOk(geo !== null);
      await workerApi.clockIn({
        workerId: worker.id,
        projectId,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60);
      }
      await refresh(worker.id);
      toast({ description: t.toast.clockedIn });
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
      await workerApi.clockOut({
        workerId: worker.id,
        ...geo,
        occurredAtClient: new Date().toISOString(),
        sourceDevice:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 40, 40]);
      }
      await refresh(worker.id);
      toast({ description: t.toast.clockedOut });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (): Promise<void> => {
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
      if (photoComment.trim()) form.append('comment', photoComment.trim());
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
    void workerApi.logout().catch(() => {});
    clearWorkerSession();
    router.replace('/worker-app');
  };

  if (!worker) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {texts.common.loading}
      </div>
    );
  }

  const clockedIn = status?.clockedIn ?? false;
  const activeProject = clockedIn ? status?.project : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-6">
      {/* Kopf: Monteur + GPS + Logout */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {initials(worker.firstName, worker.lastName)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.dashboard.greeting}</p>
            <p className="font-semibold leading-tight">
              {worker.firstName} {worker.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              gpsOk ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          >
            {gpsOk ? (
              <MapPin className="h-4 w-4" />
            ) : (
              <MapPinOff className="h-4 w-4" />
            )}
            {gpsOk ? t.dashboard.gpsActive : t.dashboard.gpsInactive}
          </span>
        </div>
      </header>

      {/* Aktuelles Projekt */}
      <section className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.dashboard.currentProject}
        </p>
        {activeProject ? (
          <div className="mt-1">
            <p className="text-lg font-semibold">{activeProject.title}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {activeProject.projectNumber}
            </p>
          </div>
        ) : current.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t.dashboard.noProject}
          </p>
        ) : current.length === 1 ? (
          <div className="mt-1">
            <p className="text-lg font-semibold">{current[0].project.title}</p>
            <p className="text-xs text-muted-foreground">
              {current[0].project.customer?.companyName ?? ''}
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {current.map((a) => (
                  <SelectItem key={a.id} value={a.project.id}>
                    {a.project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {future.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.dashboard.upcomingProjects}
            </p>
            <ul className="mt-2 space-y-1">
              {future.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between text-sm text-muted-foreground"
                >
                  <span className="truncate">{a.project.title}</span>
                  <span className="ml-2 shrink-0 text-xs">
                    {new Date(a.startDate).toLocaleDateString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Status + Stempel-Button */}
      <section className="flex flex-col items-center gap-4">
        <p className="text-center text-sm">
          {clockedIn ? (
            <span className="font-medium text-emerald-600">
              {t.dashboard.clockedInSince} {formatTime(status?.since)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t.dashboard.notClockedIn}
            </span>
          )}
        </p>

        {clockedIn && (
          <p className="font-mono text-3xl font-bold tabular-nums">
            {formatDuration(elapsedSeconds)}
          </p>
        )}

        <button
          type="button"
          disabled={busy || (!clockedIn && current.length === 0)}
          onClick={clockedIn ? handleClockOut : handleClockIn}
          className={cn(
            'flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-lg font-semibold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50',
            clockedIn
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-emerald-600 hover:bg-emerald-700',
          )}
        >
          {clockedIn ? (
            <Square className="h-10 w-10" />
          ) : (
            <Play className="h-10 w-10" />
          )}
          {busy
            ? t.dashboard.working
            : clockedIn
              ? t.dashboard.stop
              : t.dashboard.start}
        </button>
      </section>

      {/* Foto-Bereich */}
      <section>
        {!photoOpen ? (
          <Button
            variant="outline"
            className="min-h-[56px] w-full text-base"
            onClick={() => setPhotoOpen(true)}
          >
            <Camera className="h-5 w-5" />
            {t.dashboard.addPhoto}
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = '';
                setPhotoFile(f);
              }}
            />
            <Button
              variant="secondary"
              className="min-h-[56px] w-full text-base"
              onClick={() => photoInput.current?.click()}
            >
              <Camera className="h-5 w-5" />
              {photoFile ? photoFile.name : t.dashboard.addPhoto}
            </Button>
            <Input
              value={photoComment}
              onChange={(e) => setPhotoComment(e.target.value)}
              placeholder={t.dashboard.photoComment}
              className="min-h-[48px]"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="min-h-[48px] flex-1"
                onClick={() => {
                  setPhotoOpen(false);
                  setPhotoFile(null);
                  setPhotoComment('');
                }}
              >
                {t.dashboard.photoCancel}
              </Button>
              <Button
                className="min-h-[48px] flex-1"
                disabled={!photoFile || photoBusy}
                onClick={handlePhotoUpload}
              >
                {photoBusy
                  ? t.dashboard.photoUploading
                  : t.dashboard.photoUpload}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Heutige Zeiten */}
      <section>
        <p className="mb-2 text-sm font-semibold">{t.dashboard.todayTitle}</p>
        {today.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.dashboard.todayEmpty}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {today.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    e.entryType === 'CLOCK_IN'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700',
                  )}
                >
                  {e.entryType === 'CLOCK_IN'
                    ? t.dashboard.clockIn
                    : t.dashboard.clockOut}
                </span>
                <span className="font-mono">
                  {formatTime(e.occurredAtClient)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto flex min-h-[48px] items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        {t.dashboard.logout}
      </button>
    </div>
  );
}
