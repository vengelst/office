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
import { useKioskLocale } from '@/lib/kiosk-locale';
import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import { kioskDebugLog } from '@/lib/kiosk-debug';
import { usePeriodicGpsPing } from '@/lib/use-periodic-gps-ping';
import { recordWorkerGps, appendGpsToFormData } from '@/lib/record-worker-gps';
import {
  DEFAULT_PIN_LENGTH,
  kioskSettingsApi,
} from '@/lib/kiosk-settings';
import {
  activityTypesApi,
  type ActivityTypeItem,
} from '@/lib/activity-types';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import {
  KIOSK_CONFIG_KEY,
  ITEMS_IDLE_SECONDS,
  SESSION_STATES,
  type KioskState,
  type GpsData,
} from './types';
import { assignmentValidToday, tryVibrate } from './helpers';

export function useKioskTerminal() {
  const router = useRouter();
  const { lang, setLang, t, dateLocale } = useKioskLocale();

  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [state, setState] = useState<KioskState>('idle');
  const [clock, setClock] = useState(new Date());
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);
  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeItem[]>([]);
  const [selectedActivityTypeId, setSelectedActivityTypeId] = useState<string | null>(
    null,
  );
  const [gps, setGps] = useState<GpsData | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'active' | 'inactive'>('inactive');
  const [liveWorkers, setLiveWorkers] = useState<KioskWorkerStatus[]>([]);
  const [countdown, setCountdown] = useState(0);
  const lastInteraction = useRef(Date.now());
  const wantFullscreen = useRef(false);
  const liveOverviewInFlight = useRef(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmSubtext, setConfirmSubtext] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [photoPending, setPhotoPending] = useState<File | null>(null);
  const [photoComment, setPhotoComment] = useState('');

  usePeriodicGpsPing({
    active: Boolean(
      clockStatus?.clockedIn &&
        worker?.id &&
        (state === 'action' ||
          state === 'items' ||
          state === 'itemDetail' ||
          state === 'plans'),
    ),
    workerId: worker?.id,
    projectId: clockStatus?.project?.id ?? selectedProjectId,
  });

  useEffect(() => {
    void kioskSettingsApi.getPublic().then((cfg) => {
      setPinLength(cfg.pinLength);
    });
  }, []);

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

  const tryEnterFullscreen = useCallback(() => {
    if (!wantFullscreen.current) return;
    if (typeof document === 'undefined' || document.fullscreenElement) return;
    kioskDebugLog('info', 'requestFullscreen (User-Geste)');
    void document.documentElement.requestFullscreen?.().catch((err) => {
      kioskDebugLog('warn', 'Fullscreen fehlgeschlagen', String(err));
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const handlePinDigit = (digit: string) => {
    if (pin.length >= pinLength) return;
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');
    if (newPin.length === pinLength) {
      void submitPin(newPin);
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

  const handleClockIn = async () => {
    if (!worker || !config) return;
    const clockInProjectId = selectedProjectId ?? config.projectId;
    if (!assignmentValidToday(worker, clockInProjectId)) {
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
        (a) => a.project.id === clockInProjectId,
      );
      const projectTitle =
        assignment?.project.title ??
        (clockInProjectId === config.projectId ? config.projectTitle : '') ??
        '';
      const result = await kioskApi.clockIn({
        workerId: worker.id,
        projectId: clockInProjectId,
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
              id: clockInProjectId,
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

  const handleBreakStart = async () => {
    if (!worker) return;
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      const result = await kioskApi.breakStart({
        workerId: worker.id,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
      });
      setClockStatus(result);
      tryVibrate();
    } catch {
      setPinError(t(KT.error));
    } finally {
      setProcessing(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!worker) return;
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      const result = await kioskApi.breakEnd({
        workerId: worker.id,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
      });
      setClockStatus(result);
      tryVibrate();
    } catch {
      setPinError(t(KT.error));
    } finally {
      setProcessing(false);
    }
  };

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

  const handleAdminPinConfirm = () => {
    if (config && adminPinInput === config.adminPin) {
      setShowAdminDialog(false);
      setAdminPinInput('');
      router.push('/kiosk/setup');
    } else {
      setAdminPinInput('');
    }
  };

  const handleActivityTypeChange = (id: string | null) => {
    resetActivity();
    setSelectedActivityTypeId(id);
    const isIn = clockStatus?.clockedIn ?? false;
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
  };

  const activeProjectId = selectedProjectId ?? config?.projectId ?? '';

  const itemBasedProject = (worker?.assignments ?? []).some(
    (a) => a.project.id === activeProjectId && a.project.itemBased === true,
  );

  const canClockInOnKioskProject = assignmentValidToday(worker, activeProjectId);

  const displayProjectTitle =
    clockStatus?.project?.title ||
    (worker?.assignments ?? []).find((a) => a.project.id === activeProjectId)
      ?.project.title ||
    (activeProjectId === config?.projectId ? config?.projectTitle : null) ||
    config?.projectTitle ||
    '';

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

  return {
    lang,
    setLang,
    t,
    dateLocale,
    config,
    state,
    setState,
    pin,
    pinError,
    pinLoading,
    pinLength,
    worker,
    clockStatus,
    setClockStatus,
    selectedProjectId,
    setSelectedProjectId,
    activityTypes,
    selectedActivityTypeId,
    liveWorkers,
    countdown,
    confirmMessage,
    confirmSubtext,
    processing,
    showAdminDialog,
    setShowAdminDialog,
    adminPinInput,
    setAdminPinInput,
    selectedItemId,
    setSelectedItemId,
    photoPending,
    setPhotoPending,
    photoComment,
    setPhotoComment,
    tryEnterFullscreen,
    resetActivity,
    endSession,
    handlePinDigit,
    handlePinClear,
    submitPin,
    handleClockIn,
    handleClockOut,
    handleBreakStart,
    handleBreakEnd,
    handlePhoto,
    uploadPhotoWithComment,
    handleAdminPinConfirm,
    handleActivityTypeChange,
    activeProjectId,
    itemBasedProject,
    canClockInOnKioskProject,
    displayProjectTitle,
    masterProjectOptions,
    timeStr,
    dateStr,
  };
}

export type KioskTerminalContext = ReturnType<typeof useKioskTerminal>;
