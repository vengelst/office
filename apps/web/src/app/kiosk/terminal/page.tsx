'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { texts } from '@/lib/texts';
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
import type { KioskConfig } from '../setup/page';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';

type KioskState = 'idle' | 'action' | 'confirmation';

interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function KioskTerminalPage() {
  const router = useRouter();
  const t = texts.kiosk.terminal;

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

  // GPS
  const [gps, setGps] = useState<GpsData | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'active' | 'inactive'>('inactive');

  // Live overview
  const [liveWorkers, setLiveWorkers] = useState<KioskWorkerStatus[]>([]);

  // Auto-logout
  const [countdown, setCountdown] = useState(0);
  const lastInteraction = useRef(Date.now());

  // Confirmation
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmSubtext, setConfirmSubtext] = useState('');

  // Processing
  const [processing, setProcessing] = useState(false);

  // Admin PIN dialog
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');

  // Load config
  useEffect(() => {
    const raw = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (!raw) {
      router.replace('/kiosk/setup');
      return;
    }
    try {
      const c = JSON.parse(raw) as KioskConfig;
      if (!c.projectId) {
        router.replace('/kiosk/setup');
        return;
      }
      setConfig(c);
      if (c.fullscreen) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } catch {
      router.replace('/kiosk/setup');
    }
  }, [router]);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load live overview
  const loadLiveOverview = useCallback(() => {
    if (!config) return;
    kioskApi.projectStatus(config.projectId).then(setLiveWorkers).catch(() => {});
  }, [config]);

  useEffect(() => {
    loadLiveOverview();
    const id = setInterval(loadLiveOverview, 30000);
    return () => clearInterval(id);
  }, [loadLiveOverview]);

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

  // Auto-logout countdown
  useEffect(() => {
    if (state !== 'action' || !config) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastInteraction.current) / 1000);
      const remaining = Math.max(0, config.autoLogoutSeconds - elapsed);
      setCountdown(remaining);
      if (remaining === 0) {
        resetToIdle();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, config]);

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
    clearWorkerSession();
    loadLiveOverview();
  }, [loadLiveOverview]);

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
      const status = await kioskApi.status(me.id);
      setClockStatus(status);
      setState('action');
      lastInteraction.current = Date.now();
      acquireGps();
    } catch {
      setPinError(t.pinError);
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  // Clock in/out
  const handleClockIn = async () => {
    if (!worker || !config) return;
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      await kioskApi.clockIn({
        workerId: worker.id,
        projectId: config.projectId,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
      });
      const now = formatTime(new Date().toISOString());
      setConfirmMessage(t.confirmClockIn(`${worker.firstName} ${worker.lastName}`, now));
      setConfirmSubtext(t.goodDay);
      setState('confirmation');
      tryVibrate();
      setTimeout(resetToIdle, 3000);
    } catch {
      setPinError(t.error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!worker) return;
    resetActivity();
    setProcessing(true);
    try {
      const gpsData = gps ?? (await acquireGps());
      const res = await kioskApi.clockOut({
        workerId: worker.id,
        latitude: gpsData?.latitude,
        longitude: gpsData?.longitude,
        accuracy: gpsData?.accuracy,
        occurredAtClient: new Date().toISOString(),
        sourceDevice: 'kiosk',
      });
      const now = formatTime(new Date().toISOString());
      const duration = res.lastGrossMinutes
        ? formatDuration(res.lastGrossMinutes * 60)
        : '';
      setConfirmMessage(t.confirmClockOut(`${worker.firstName} ${worker.lastName}`, now, duration));
      setConfirmSubtext(t.goodBye);
      setState('confirmation');
      tryVibrate();
      setTimeout(resetToIdle, 3000);
    } catch {
      setPinError(t.error);
    } finally {
      setProcessing(false);
    }
  };

  // Photo
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!worker || !config) return;
    resetActivity();
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('workerId', worker.id);
      form.append('projectId', config.projectId);
      await kioskApi.uploadPhoto(form);
    } catch {
      // silently fail photo upload
    } finally {
      setProcessing(false);
      e.target.value = '';
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

  if (!config) return null;

  const timeStr = clock.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── CONFIRMATION STATE ──
  if (state === 'confirmation') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="text-8xl">✅</div>
        <p className="text-center text-3xl font-bold">{confirmMessage}</p>
        <p className="text-xl text-gray-400">{confirmSubtext}</p>
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
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <button
            onClick={resetToIdle}
            className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
          >
            ← {t.back}
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
          <p className={`text-xl ${isIn ? 'text-green-400' : 'text-gray-400'}`}>
            {isIn
              ? `${t.clockedInSince} ${sinceStr}`
              : t.notClockedIn}
          </p>
          {isIn && (
            <p className="text-3xl font-mono tabular-nums text-green-300">
              {formatDuration(durationSec)}
            </p>
          )}
        </div>

        {/* GPS indicator */}
        <div className="mt-4 flex justify-center">
          <span className={`text-sm ${gpsStatus === 'active' ? 'text-green-400' : gpsStatus === 'acquiring' ? 'text-yellow-400' : 'text-gray-500'}`}>
            📍 {gpsStatus === 'active' ? t.gpsActive : gpsStatus === 'acquiring' ? t.gpsAcquiring : t.gpsInactive}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-auto flex flex-col items-center gap-4 pb-8">
          {!isIn ? (
            <button
              onClick={handleClockIn}
              disabled={processing}
              className="w-full max-w-md rounded-2xl bg-green-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-green-900/50 transition hover:bg-green-500 active:scale-95 disabled:opacity-60"
              style={{ minHeight: '120px' }}
            >
              {processing ? t.processing : `▶ ${t.startWork}`}
            </button>
          ) : (
            <>
              <button
                onClick={handleClockOut}
                disabled={processing}
                className="w-full max-w-md rounded-2xl bg-red-600 px-8 py-8 text-3xl font-bold text-white shadow-lg shadow-red-900/50 transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
                style={{ minHeight: '120px' }}
              >
                {processing ? t.processing : `■ ${t.stopWork}`}
              </button>
              {config.cameraEnabled && (
                <label className="w-full max-w-md cursor-pointer rounded-xl bg-gray-800 px-6 py-4 text-center text-xl text-gray-200 transition hover:bg-gray-700">
                  📷 {t.takePhoto}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    className="hidden"
                  />
                </label>
              )}
            </>
          )}

          {/* Upcoming projects */}
          {!isIn && worker.assignments.length > 1 && (
            <div className="mt-4 w-full max-w-md rounded-xl bg-gray-800/50 p-4">
              <h4 className="mb-2 text-sm font-medium text-gray-500">{t.upcomingProjects}</h4>
              {worker.assignments.slice(1).map((a) => (
                <div key={a.id} className="text-sm text-gray-500">
                  {a.project.title}
                  {a.startDate && ` (ab ${new Date(a.startDate).toLocaleDateString('de-DE')})`}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-logout */}
        <div className="fixed bottom-4 left-0 right-0 text-center text-sm text-gray-600">
          {t.autoLogout(countdown)}
        </div>
      </div>
    );
  }

  // ── IDLE STATE (PIN entry) ──
  return (
    <div className="flex min-h-screen flex-col p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <button
          onClick={() => setShowAdminDialog(true)}
          className="rounded-lg bg-gray-800/50 px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-700"
        >
          {t.setupButton}
        </button>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{timeStr}</div>
          <div className="text-sm text-gray-500">{dateStr}</div>
        </div>
      </div>

      {/* Project title */}
      <div className="mt-6 text-center">
        <h1 className="text-3xl font-bold text-white lg:text-4xl">
          {config.projectTitle}
        </h1>
      </div>

      {/* PIN pad */}
      <div className="mx-auto mt-8 w-full max-w-sm">
        <p className="mb-4 text-center text-lg text-gray-400">{t.pinTitle}</p>

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
          <p className="mb-4 text-center text-blue-400">{t.pinChecking}</p>
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
            {t.clear}
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
            {t.confirm}
          </button>
        </div>
      </div>

      {/* Live overview */}
      {liveWorkers.length > 0 && (
        <div className="mx-auto mt-8 w-full max-w-lg">
          <div className="rounded-xl bg-gray-900/80 p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-500">{t.liveOverview}</h3>
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
                        {t.since} {formatTime(w.since)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
            {liveWorkers.some((w) => !w.clockedIn) && (
              <>
                <h4 className="mb-2 mt-4 text-xs font-medium text-gray-600">{t.notOnSite}</h4>
                <div className="space-y-1">
                  {liveWorkers
                    .filter((w) => !w.clockedIn)
                    .map((w) => (
                      <div key={w.workerId} className="flex items-center gap-2 text-sm">
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
        </div>
      )}

      {/* Admin PIN Dialog */}
      {showAdminDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-gray-900 p-6">
            <h3 className="text-xl font-bold">{t.adminPinPrompt}</h3>
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
                {t.back}
              </button>
              <button
                onClick={handleAdminPinConfirm}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-500"
              >
                {t.confirm}
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
