/**
 * Seite: kiosk / terminal (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  kioskApi,
  setWorkerSession,
  clearWorkerSession,
  formatDuration,
  formatTime,
  type WorkerMe,
  type ClockStatus,
  type KioskWorkerStatus,
} from '@/lib/timesheets';
import {
  getOptimisticClockStatus,
  startOfflineClockSync,
} from '@/lib/offline-clock-queue';
import { OfflineClockBanner } from '@/components/offline-clock-banner';
import { WorkItemsList } from '@/components/worker-work-items/work-items-list';
import { WorkItemDetail } from '@/components/worker-work-items/work-item-detail';
import { PhotoCommentComposer } from '@/components/kiosk/photo-comment-composer';
import { KIOSK_LANGS, useKioskLocale } from '@/lib/kiosk-locale';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import { kioskDebugLog } from '@/lib/kiosk-debug';
import { usePeriodicGpsPing } from '@/lib/use-periodic-gps-ping';
import { recordWorkerGps, appendGpsToFormData } from '@/lib/record-worker-gps';
import {
  activityTypesApi,
  type ActivityTypeItem,
} from '@/lib/activity-types';
import type { KioskConfig } from '../setup/page';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

function dayStartMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Gültige aktive Zuweisung für das Kiosk-Projekt (heute), oder Master-Monteur. */
function assignmentValidToday(
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

/**
 * Mindest-Leerlauf auf den Arbeitsitems-Screens.
 *
 * Der Kiosk-Auto-Logout (Default 15 s) passt zum Stempeln mit zwei Tipps, nicht
 * zum Lesen einer Arbeitskarte oder zum Fotografieren – dabei liegt das Tablet
 * unberührt in der Hand. Jede Interaktion setzt den Zähler wie gewohnt zurück,
 * nur das Fenster ist hier größer (nie kleiner als die konfigurierte Zeit).
 */
const ITEMS_IDLE_SECONDS = 180;

type KioskState = 'idle' | 'action' | 'confirmation' | 'items' | 'itemDetail';

/** Screens, auf denen die Monteur-Session weiterläuft (Auto-Logout aktiv). */
const SESSION_STATES: KioskState[] = ['action', 'items', 'itemDetail'];

interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * UI-Komponente `KioskTerminalPage`.
 */
export default function KioskTerminalPage() {
  const router = useRouter();
  const { lang, setLang, t, dateLocale } = useKioskLocale();

  // Config
  const [config, setConfig] = useState<KioskConfig | null>(null);

  // State machine
  const [state, setState] = useState<KioskState>('idle');

  // Clock
  const [clock, setClock] = useState(new Date());

  // PIN
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Worker (after PIN)
  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  /** Projekt fürs Einstempeln (Master kann wählen; sonst Kiosk-Setup-Projekt). */
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeItem[]>([]);
  const [selectedActivityTypeId, setSelectedActivityTypeId] = useState<string | null>(
    null,
  );

  // GPS
  const [gps, setGps] = useState<GpsData | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'active' | 'inactive'>('inactive');

  // Live overview
  const [liveWorkers, setLiveWorkers] = useState<KioskWorkerStatus[]>([]);

  // Auto-logout
  const [countdown, setCountdown] = useState(0);
  const lastInteraction = useRef(Date.now());
  /** Fullscreen nur nach User-Geste (Browser-API). */
  const wantFullscreen = useRef(false);
  const liveOverviewInFlight = useRef(false);

  // Confirmation
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmSubtext, setConfirmSubtext] = useState('');

  // Processing
  const [processing, setProcessing] = useState(false);

  // Admin PIN dialog
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');

  // Arbeitsitems (SPEZ-arbeitsitems.md 6/13) – gleiche Komponenten wie /worker-app
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Foto + Kommentar (eingebrannt in Bild)
  const [photoPending, setPhotoPending] = useState<File | null>(null);
  const [photoComment, setPhotoComment] = useState('');

  usePeriodicGpsPing({
    active: Boolean(
      clockStatus?.clockedIn &&
        worker?.id &&
        (state === 'action' || state === 'items' || state === 'itemDetail'),
    ),
    workerId: worker?.id,
    projectId: clockStatus?.project?.id ?? selectedProjectId,
  });

  // Load config (einmalig – nicht bei jeder router-Identity)
  useEffect(() => {
    kioskDebugLog('mount', 'Terminal mount');
    const raw = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (!raw) {
      kioskDebugLog('nav', 'Terminal → setup (keine Config)');
      router.replace('/kiosk/setup');
      return;
    }
    try {
      const c = JSON.parse(raw) as KioskConfig;
      if (!c.projectId) {
        kioskDebugLog('nav', 'Terminal → setup (kein projectId)');
        router.replace('/kiosk/setup');
        return;
      }
      if (c.mode === 'customer_pl') {
        kioskDebugLog('nav', 'Terminal → pl (customer_pl)');
        router.replace('/kiosk/pl');
        return;
      }
      kioskDebugLog('info', 'Config geladen', c.projectTitle ?? c.projectId);
      setConfig(c);
      setSelectedProjectId(c.projectId);
      startOfflineClockSync();
      wantFullscreen.current = Boolean(c.fullscreen);
    } catch {
      kioskDebugLog('error', 'Config JSON ungültig');
      router.replace('/kiosk/setup');
    }
    return () => {
      kioskDebugLog('mount', 'Terminal unmount');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount
  }, []);

  /** Vollbild erst beim Tippen – requestFullscreen braucht eine User-Geste. */
  const tryEnterFullscreen = useCallback(() => {
    if (!wantFullscreen.current) return;
    if (typeof document === 'undefined' || document.fullscreenElement) return;
    kioskDebugLog('info', 'requestFullscreen (User-Geste)');
    void document.documentElement.requestFullscreen?.().catch((err) => {
      kioskDebugLog('warn', 'Fullscreen fehlgeschlagen', String(err));
    });
  }, []);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load live overview
  const projectId = config?.projectId;
  const loadLiveOverview = useCallback(() => {
    if (!projectId || liveOverviewInFlight.current) return;
    liveOverviewInFlight.current = true;
    kioskDebugLog('api', 'projectStatus starten', projectId);
    kioskApi
      .projectStatus(projectId)
      .then((rows) => {
        kioskDebugLog('info', `projectStatus OK (${rows.length})`);
        setLiveWorkers(rows);
      })
      .catch((err) => {
        kioskDebugLog('error', 'projectStatus fehlgeschlagen', String(err));
      })
      .finally(() => {
        liveOverviewInFlight.current = false;
      });
  }, [projectId]);

  useEffect(() => {
    if (state !== 'action' || !worker?.masterEngineer) {
      return;
    }
    loadLiveOverview();
    const id = setInterval(loadLiveOverview, 30000);
    return () => clearInterval(id);
  }, [loadLiveOverview, state, worker?.masterEngineer]);

  // GPS acquisition
  const acquireGps = useCallback((): Promise<GpsData | null> => {
    setGpsStatus('acquiring');
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsStatus('inactive');
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => {
        setGpsStatus('inactive');
        resolve(null);
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          const data: GpsData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGps(data);
          setGpsStatus('active');
          resolve(data);
        },
        () => {
          clearTimeout(timeout);
          setGpsStatus('inactive');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, []);

  const resetActivity = () => {
    lastInteraction.current = Date.now();
  };

  const resetToIdle = useCallback(() => {
    setState('idle');
    setWorker(null);
    setClockStatus(null);
    setPin('');
    setPinError('');
    setGps(null);
    setGpsStatus('inactive');
    setSelectedItemId(null);
    setSelectedProjectId(config?.projectId ?? null);
    setLiveWorkers([]);
    clearWorkerSession();
  }, [config?.projectId]);

  /** Logout inkl. Auto-Logout: zuerst GPS, dann Session beenden. */
  const endSession = useCallback(async () => {
    const w = worker;
    if (w?.id) {
      await recordWorkerGps({
        workerId: w.id,
        eventType: 'LOGOUT',
        projectId:
          clockStatus?.project?.id ?? selectedProjectId ?? config?.projectId,
        timeoutMs: 5000,
      });
    }
    resetToIdle();
  }, [
    worker,
    clockStatus?.project?.id,
    selectedProjectId,
    config?.projectId,
    resetToIdle,
  ]);

  // Auto-logout countdown (läuft auf allen Screens der Monteur-Session)
  useEffect(() => {
    if (!SESSION_STATES.includes(state) || !config) return;
    const limit =
      state === 'action'
        ? config.autoLogoutSeconds
        : Math.max(config.autoLogoutSeconds, ITEMS_IDLE_SECONDS);
    let fired = false;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastInteraction.current) / 1000);
      const remaining = Math.max(0, limit - elapsed);
      setCountdown(remaining);
      if (remaining === 0 && !fired) {
        fired = true;
        void endSession();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state, config, endSession]);

  // PIN pad
  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');
    if (newPin.length === 6) {
      submitPin(newPin);
    }
  };

  const handlePinClear = () => {
    setPin('');
    setPinError('');
  };

  const submitPin = async (pinValue: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const loginRes = await kioskApi.pinLogin(pinValue);
      const token = loginRes.accessToken;
      // Store token for subsequent calls
      if (typeof window !== 'undefined') {
        localStorage.setItem('office_worker_token', token);
      }
      const me = await kioskApi.me();
      setWorkerSession(token, me);
      setWorker(me);
      let status: ClockStatus;
      try {
        status = await kioskApi.status(me.id);
      } catch {
        status = {
          clockedIn: false,
          since: null,
          durationMinutes: 0,
          project: null,
          timeEntryId: null,
        };
      }
      const merged = await getOptimisticClockStatus(me.id, status);
      setClockStatus(merged);
      // Master: wenn schon eingestempelt → aktuelles Projekt; sonst Setup-Default
      const defaultProjectId =
        merged.clockedIn && merged.project?.id
          ? merged.project.id
          : config?.projectId ?? null;
      setSelectedProjectId(defaultProjectId);
      setSelectedActivityTypeId(null);
      if (me.masterEngineer) {
        void activityTypesApi
          .listActiveForWorker()
          .then((list) => {
            setActivityTypes(list);
            if (list[0]) setSelectedActivityTypeId(list[0].id);
          })
          .catch(() => setActivityTypes([]));
      } else {
        setActivityTypes([]);
      }
      setState('action');
      lastInteraction.current = Date.now();
      acquireGps();
      void recordWorkerGps({
        workerId: me.id,
        eventType: 'LOGIN',
        projectId: defaultProjectId,
        timeoutMs: 10000,
      });
    } catch {
      setPinError(t(KT.pinError));
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  // Clock in/out
  const handleClockIn = async () => {
    if (!worker || !config) return;
    const projectId = selectedProjectId ?? config.projectId;
    if (!assignmentValidToday(worker, projectId)) {
      return;
    }
    if (worker.masterEngineer && !selectedActivityTypeId) {
      setPinError(t(KT.activityRequired));
      return;
    }
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      const assignment = (worker.assignments ?? []).find(
        (a) => a.project.id === projectId,
      );
      const projectTitle =
        assignment?.project.title ??
        (projectId === config.projectId ? config.projectTitle : '') ??
        '';
      const result = await kioskApi.clockIn({
        workerId: worker.id,
        projectId,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
        activityTypeId: selectedActivityTypeId ?? undefined,
        projectSnapshot: assignment
          ? {
              id: assignment.project.id,
              projectNumber: assignment.project.projectNumber,
              title: assignment.project.title,
            }
          : {
              id: projectId,
              projectNumber: '',
              title: projectTitle,
            },
      });
      setClockStatus(result);
      const now = formatTime(new Date().toISOString());
      if (result.queued) {
        setConfirmMessage(
          `${worker.firstName} ${worker.lastName} – ${t(KT.savedPending)}`,
        );
        setConfirmSubtext(t(KT.goodDay));
      } else {
        setConfirmMessage(
          t(
            KT.confirmClockIn(
              `${worker.firstName} ${worker.lastName}`,
              now,
            ),
          ),
        );
        setConfirmSubtext(t(KT.goodDay));
      }
      setState('confirmation');
      tryVibrate();
      setTimeout(() => {
        void endSession();
      }, 3000);
    } catch {
      setPinError(t(KT.error));
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!worker || !config) return;
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      const result = await kioskApi.clockOut({
        workerId: worker.id,
        projectId: config.projectId,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
      });
      setClockStatus(result);
      const now = formatTime(new Date().toISOString());
      if (result.queued) {
        setConfirmMessage(
          `${worker.firstName} ${worker.lastName} – ${t(KT.savedPending)}`,
        );
        setConfirmSubtext(t(KT.goodBye));
      } else {
        const duration = result.lastGrossMinutes
          ? formatDuration(result.lastGrossMinutes * 60)
          : '';
        setConfirmMessage(
          t(
            KT.confirmClockOut(
              `${worker.firstName} ${worker.lastName}`,
              now,
              duration,
            ),
          ),
        );
        setConfirmSubtext(t(KT.goodBye));
      }
      setState('confirmation');
      tryVibrate();
      setTimeout(() => {
        void endSession();
      }, 3000);
    } catch {
      setPinError(t(KT.error));
    } finally {
      setProcessing(false);
    }
  };

  // Photo
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!worker || !config) return;
    resetActivity();
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoPending(file);
    setPhotoComment('');
  };

  const uploadPhotoWithComment = async (opts: {
    comment: string;
    xNorm?: number | null;
    yNorm?: number | null;
  }) => {
    if (!worker || !config || !photoPending) return;
    resetActivity();
    setProcessing(true);
    try {
      const form = new FormData();
      form.append('file', photoPending);
      form.append('workerId', worker.id);
      form.append(
        'projectId',
        clockStatus?.project?.id ?? selectedProjectId ?? config.projectId,
      );
      if (opts.comment.trim()) form.append('comment', opts.comment.trim());
      if (opts.xNorm != null && opts.yNorm != null) {
        form.append('commentX', String(opts.xNorm));
        form.append('commentY', String(opts.yNorm));
      }
      await appendGpsToFormData(form);
      await kioskApi.uploadPhoto(form);
    } catch {
      // silently fail photo upload
    } finally {
      setProcessing(false);
      setPhotoPending(null);
      setPhotoComment('');
    }
  };

  // Admin PIN
  const handleAdminPinConfirm = () => {
    if (config && adminPinInput === config.adminPin) {
      setShowAdminDialog(false);
      setAdminPinInput('');
      router.push('/kiosk/setup');
    } else {
      setAdminPinInput('');
    }
  };

  if (!config) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400"
        onPointerDown={tryEnterFullscreen}
      >
        Laden …
      </div>
    );
  }

  /**
   * Ist das gewählte (bzw. Kiosk-)Projekt item-basiert?
   *
   * Bewusst zur Laufzeit aus `/worker-auth/me` gelesen (Zuweisung des gerade
   * angemeldeten Monteurs) statt aus der gespeicherten Kiosk-Config: Ein alter
   * Config-Eintrag im LocalStorage kennt das Flag nicht, und der Item-Modus
   * kann im Büro jederzeit umgeschaltet werden.
   */
  const activeProjectId = selectedProjectId ?? config.projectId;

  const itemBasedProject = (worker?.assignments ?? []).some(
    (a) => a.project.id === activeProjectId && a.project.itemBased === true,
  );

  const canClockInOnKioskProject = assignmentValidToday(worker, activeProjectId);

  /** Anzeige-Titel: eingestempelt → Status-Projekt; sonst Auswahl / Setup. */
  const displayProjectTitle =
    clockStatus?.project?.title ||
    (worker?.assignments ?? []).find((a) => a.project.id === activeProjectId)
      ?.project.title ||
    (activeProjectId === config.projectId ? config.projectTitle : null) ||
    config.projectTitle;

  /** Master: eindeutige Projekte aus Assignments (API liefert ACTIVE/PLANNED). */
  const masterProjectOptions = worker?.masterEngineer
    ? Array.from(
        new Map(
          (worker.assignments ?? []).map((a) => [
            a.project.id,
            {
              id: a.project.id,
              title: a.project.title,
              projectNumber: a.project.projectNumber,
            },
          ]),
        ).values(),
      )
    : [];

  const timeStr = clock.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = clock.toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ── CONFIRMATION STATE ──
  if (state === 'confirmation') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
        onPointerDown={tryEnterFullscreen}
      >
        <div className="text-8xl">✅</div>
        <p className="text-center text-3xl font-bold">{confirmMessage}</p>
        <p className="text-xl text-gray-400">{confirmSubtext}</p>
      </div>
    );
  }

  // ── ARBEITSITEMS (Liste / Detail) ──
  // Gleiche Komponenten wie `/worker-app` – ein Screen, zwei Einstiege.
  // Jede Berührung zählt als Aktivität, damit der Auto-Logout nicht zuschlägt.
  if ((state === 'items' || state === 'itemDetail') && worker) {
    return (
      <div
        onClick={resetActivity}
        onTouchStart={resetActivity}
        onKeyDown={resetActivity}
        onPointerDown={tryEnterFullscreen}
      >
        {state === 'items' ? (
          <WorkItemsList
            workerId={worker.id}
            projectId={config.projectId}
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
        {/* Auto-Logout erst kurz vorher einblenden – sonst stört er beim Lesen. */}
        {countdown > 0 && countdown <= 30 && (
          <div className="fixed bottom-2 left-0 right-0 text-center text-xs text-gray-500">
            {t(KT.autoLogout(countdown))}
          </div>
        )}
      </div>
    );
  }

  // ── ACTION STATE (after PIN) ──
  if (state === 'action' && worker) {
    const isIn = clockStatus?.clockedIn ?? false;
    const sinceStr = clockStatus?.since ? formatTime(clockStatus.since) : '';
    const durationSec = clockStatus?.since
      ? Math.floor((Date.now() - new Date(clockStatus.since).getTime()) / 1000)
      : 0;

    return (
      <div
        className="flex min-h-screen flex-col p-6"
        onClick={resetActivity}
        onTouchStart={resetActivity}
        onPointerDown={tryEnterFullscreen}
      >
        <OfflineClockBanner
          workerId={worker.id}
          variant="dark"
          className="mb-4"
        />

        {/* Header */}
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

        {/* Worker info */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-700 text-4xl font-bold uppercase">
            {worker.firstName[0]}{worker.lastName[0]}
          </div>
          <h2 className="text-4xl font-bold">
            {worker.firstName} {worker.lastName}
          </h2>
          <p className="text-center text-lg text-gray-300">
            <span className="text-gray-500">{t(KT.projectLabel)}: </span>
            {displayProjectTitle}
          </p>
          <p className={`text-xl ${isIn ? 'text-green-400' : 'text-gray-400'}`}>
            {isIn
              ? `${t(KT.clockedInSince)} ${sinceStr}`
              : t(KT.notClockedIn)}
          </p>
          {isIn && (
            <p className="text-3xl font-mono tabular-nums text-green-300">
              {formatDuration(durationSec)}
            </p>
          )}
        </div>

        {/* Master-Monteur: Projekt wählen, auf das gestempelt wird */}
        {worker.masterEngineer && !isIn && masterProjectOptions.length > 0 && (
          <div className="mx-auto mt-6 w-full max-w-md">
            <label className="mb-2 block text-center text-sm text-gray-400">
              {t(KT.chooseProject)}
            </label>
            <select
              value={activeProjectId}
              onChange={(e) => {
                resetActivity();
                setSelectedProjectId(e.target.value);
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-lg text-white"
              style={{ minHeight: '56px' }}
            >
              {/* Setup-Projekt immer anbieten */}
              {!masterProjectOptions.some((p) => p.id === config.projectId) && (
                <option value={config.projectId}>{config.projectTitle}</option>
              )}
              {masterProjectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectNumber ? `${p.projectNumber} · ` : ''}
                  {p.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-center text-xs text-gray-500">
              {t(KT.bookingOn)}
            </p>
          </div>
        )}

        {/* Master: Tätigkeit wählen / wechseln */}
        {worker.masterEngineer && activityTypes.length > 0 && (
          <div className="mx-auto mt-4 w-full max-w-md">
            <label className="mb-2 block text-center text-sm text-gray-400">
              {isIn ? t(KT.switchActivity) : t(KT.chooseActivity)}
            </label>
            {isIn && clockStatus?.currentActivity && (
              <p className="mb-2 text-center text-sm text-emerald-400">
                {t(KT.currentActivity)}: {clockStatus.currentActivity.name}
              </p>
            )}
            <select
              value={selectedActivityTypeId ?? ''}
              onChange={(e) => {
                resetActivity();
                const id = e.target.value || null;
                setSelectedActivityTypeId(id);
                if (isIn && id && worker) {
                  void (async () => {
                    try {
                      const gpsData = gps ?? (await acquireGps());
                      const next = await kioskApi.switchActivity({
                        workerId: worker.id,
                        activityTypeId: id,
                        latitude: gpsData?.latitude,
                        longitude: gpsData?.longitude,
                        accuracy: gpsData?.accuracy,
                      });
                      setClockStatus(next);
                    } catch {
                      /* ignore */
                    }
                  })();
                }
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-lg text-white"
              style={{ minHeight: '56px' }}
            >
              {activityTypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Master: wer ist heute auf dem Projekt eingestempelt */}
        {worker.masterEngineer && liveWorkers.length > 0 && (
          <div className="mx-auto mt-6 w-full max-w-md rounded-xl bg-gray-900/80 p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-500">
              {t(KT.liveOverview)}
            </h3>
            <div className="space-y-2">
              {liveWorkers
                .filter((w) => w.clockedIn)
                .map((w) => (
                  <div key={w.workerId} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="text-gray-200">
                      {w.firstName} {w.lastName}
                    </span>
                    {w.since && (
                      <span className="ml-auto text-gray-500">
                        {t(KT.since)} {formatTime(w.since)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
            {liveWorkers.some((w) => !w.clockedIn) && (
              <>
                <h4 className="mb-2 mt-4 text-xs font-medium text-gray-600">
                  {t(KT.notOnSite)}
                </h4>
                <div className="space-y-1">
                  {liveWorkers
                    .filter((w) => !w.clockedIn)
                    .map((w) => (
                      <div
                        key={w.workerId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-600" />
                        <span className="text-gray-500">
                          {w.firstName} {w.lastName}
                        </span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-auto flex flex-col items-center gap-4 pb-8">
          {!isIn ? (
            <>
              <button
                onClick={handleClockIn}
                disabled={processing || !canClockInOnKioskProject}
                className="w-full max-w-md rounded-2xl bg-green-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-green-900/50 transition hover:bg-green-500 active:scale-95 disabled:opacity-60"
                style={{ minHeight: '120px' }}
              >
                {processing ? t(KT.processing) : `▶ ${t(KT.startWork)}`}
              </button>
              {!canClockInOnKioskProject && (
                <p className="max-w-md text-center text-sm text-amber-400">
                  {t(KT.noAssignment)}
                </p>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleClockOut}
                disabled={processing}
                className="w-full max-w-md rounded-2xl bg-red-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-red-900/50 transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
                style={{ minHeight: '120px' }}
              >
                {processing ? t(KT.processing) : `■ ${t(KT.stopWork)}`}
              </button>
              {config.cameraEnabled && (
                <label className="w-full max-w-md cursor-pointer rounded-xl bg-gray-800 px-6 py-4 text-center text-xl text-gray-200 transition hover:bg-gray-700">
                  📷 {t(KT.takePhoto)}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    className="hidden"
                  />
                </label>
              )}
              {/* Arbeitsitems – nur bei item-basiertem Projekt und eingestempelt */}
              {itemBasedProject && (
                <button
                  onClick={() => {
                    resetActivity();
                    setState('items');
                  }}
                  className="w-full max-w-md rounded-xl bg-blue-600/90 px-6 py-4 text-center text-xl font-semibold text-white transition hover:bg-blue-500 active:scale-95"
                >
                  📋 {t(KT.workItems)}
                </button>
              )}
            </>
          )}

          {/* Upcoming projects */}
          {!isIn && worker.assignments.length > 1 && (
            <div className="mt-4 w-full max-w-md rounded-xl bg-gray-800/50 p-4">
              <h4 className="mb-2 text-sm font-medium text-gray-500">{t(KT.upcomingProjects)}</h4>
              {worker.assignments.slice(1).map((a) => (
                <div key={a.id} className="text-sm text-gray-500">
                  {a.project.title}
                  {a.startDate && ` (ab ${new Date(a.startDate).toLocaleDateString(dateLocale)})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Foto-Kommentar-Dialog */}
        {photoPending && (
          <PhotoCommentComposer
            file={photoPending}
            comment={photoComment}
            onCommentChange={setPhotoComment}
            title={t(KT.photoCommentTitle)}
            hint={t(KT.photoCommentHint)}
            placeButton={t(KT.photoCommentPlace)}
            placeHint={t(KT.photoCommentPlaceHint)}
            placeDone={t(KT.photoCommentPlaceDone)}
            clearPlace={t(KT.photoCommentClearPlace)}
            saveLabel={
              processing ? t(KT.photoUploading) : t(KT.photoCommentSave)
            }
            skipLabel={t(KT.photoCommentSkip)}
            cancelLabel={t(KT.back)}
            uploading={processing}
            dark
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

        {/* Auto-logout */}
        <div className="fixed bottom-4 left-0 right-0 text-center text-sm text-gray-600">
          {t(KT.autoLogout(countdown))}
        </div>
      </div>
    );
  }

  // ── IDLE STATE (PIN entry) ──
  return (
    <div
      className="flex min-h-screen flex-col p-6"
      onPointerDown={tryEnterFullscreen}
    >
      <OfflineClockBanner variant="dark" className="mb-4" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setShowAdminDialog(true)}
          className="rounded-lg bg-gray-800/50 px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-700"
        >
          {t(KT.setupButton)}
        </button>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{timeStr}</div>
          <div className="text-sm text-gray-500">{dateStr}</div>
        </div>
      </div>

      {/* Language */}
      <div className="mt-4 flex justify-center gap-2" role="group" aria-label={t(KT.language)}>
        {KIOSK_LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLang(l.id)}
            className={`min-w-[4.5rem] rounded-xl px-4 py-3 text-lg font-bold transition active:scale-95 ${
              lang === l.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Project title */}
      <div className="mt-6 text-center">
        <h1 className="text-3xl font-bold text-white lg:text-4xl">
          {config.projectTitle}
        </h1>
      </div>

      {/* PIN pad */}
      <div className="mx-auto mt-8 w-full max-w-sm">
        <p className="mb-4 text-center text-lg text-gray-400">{t(KT.pinTitle)}</p>

        {/* PIN dots */}
        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? 'border-blue-400 bg-blue-400'
                  : 'border-gray-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        {pinError && (
          <p className="mb-4 text-center text-red-400">{pinError}</p>
        )}
        {pinLoading && (
          <p className="mb-4 text-center text-blue-400">{t(KT.pinChecking)}</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handlePinDigit(d)}
              disabled={pinLoading}
              className="flex h-20 items-center justify-center rounded-xl bg-gray-800 text-3xl font-bold text-white transition hover:bg-gray-700 active:scale-95 disabled:opacity-50 lg:h-24 lg:text-4xl"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handlePinClear}
            disabled={pinLoading}
            className="flex h-20 items-center justify-center rounded-xl bg-gray-800 text-lg font-medium text-gray-400 transition hover:bg-gray-700 active:scale-95 lg:h-24"
          >
            {t(KT.clear)}
          </button>
          <button
            onClick={() => handlePinDigit('0')}
            disabled={pinLoading}
            className="flex h-20 items-center justify-center rounded-xl bg-gray-800 text-3xl font-bold text-white transition hover:bg-gray-700 active:scale-95 disabled:opacity-50 lg:h-24 lg:text-4xl"
          >
            0
          </button>
          <button
            onClick={() => pin.length === 6 && submitPin(pin)}
            disabled={pin.length < 6 || pinLoading}
            className="flex h-20 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-40 lg:h-24"
          >
            {t(KT.confirm)}
          </button>
        </div>
      </div>

      {/* Admin PIN Dialog */}
      {showAdminDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-gray-900 p-6">
            <h3 className="text-xl font-bold">{t(KT.adminPinPrompt)}</h3>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdminDialog(false);
                  setAdminPinInput('');
                }}
                className="flex-1 rounded-lg bg-gray-700 py-3 text-gray-300 transition hover:bg-gray-600"
              >
                {t(KT.back)}
              </button>
              <button
                onClick={handleAdminPinConfirm}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-500"
              >
                {t(KT.confirm)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function tryVibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(200);
  }
}
