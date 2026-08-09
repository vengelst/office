'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  type TimesheetListItem,
} from '@/lib/timesheets';
import type { KioskConfig } from '../setup/page';
import type { AuthUser, LoginResponse } from '@office/types';

const KIOSK_CONFIG_KEY = 'office_kiosk_config';
const PL_TOKEN_KEY = 'office_kiosk_pl_token';
const PL_USER_KEY = 'office_kiosk_pl_user';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

const PL_IDLE_SECONDS = 120;

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function weekdayLabel(iso: string): string {
  return texts.timesheets.days[DAY_KEYS[new Date(iso).getDay()]];
}

type PlState = 'idle' | 'list' | 'detail' | 'confirmation';

async function plFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(PL_TOKEN_KEY) : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'message' in data
      ? String((data as { message: string }).message)
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export default function KioskPlPage() {
  const router = useRouter();
  const t = texts.kiosk.pl;
  const tTimesheets = texts.timesheets;

  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [state, setState] = useState<PlState>('idle');
  const [clock, setClock] = useState(new Date());

  // PIN
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // User (after PIN)
  const [user, setUser] = useState<AuthUser | null>(null);

  // Timesheets list
  const [sheets, setSheets] = useState<TimesheetListItem[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  // Detail
  const [detail, setDetail] = useState<TimesheetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Signature
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  // Confirmation
  const [confirmMessage, setConfirmMessage] = useState('');

  // Auto-logout
  const [countdown, setCountdown] = useState(0);
  const lastInteraction = useRef(Date.now());

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
      if (c.mode !== 'customer_pl') {
        router.replace('/kiosk/terminal');
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

  // Auto-logout
  useEffect(() => {
    if (state === 'idle' || state === 'confirmation' || !config) return;
    const limit = Math.max(config.autoLogoutSeconds, PL_IDLE_SECONDS);
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastInteraction.current) / 1000);
      const remaining = Math.max(0, limit - elapsed);
      setCountdown(remaining);
      if (remaining === 0) resetToIdle();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, config]);

  const resetActivity = () => {
    lastInteraction.current = Date.now();
  };

  const resetToIdle = useCallback(() => {
    setState('idle');
    setUser(null);
    setPin('');
    setPinError('');
    setSheets([]);
    setDetail(null);
    setSignerName('');
    setSignError('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PL_TOKEN_KEY);
      localStorage.removeItem(PL_USER_KEY);
    }
  }, []);

  // PIN pad handlers
  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');
    if (newPin.length === 6) submitPin(newPin);
  };

  const handlePinClear = () => {
    setPin('');
    setPinError('');
  };

  const submitPin = async (pinValue: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const loginRes = await plFetch<LoginResponse>('/auth/user-pin-login', {
        method: 'POST',
        body: { pin: pinValue },
      });
      localStorage.setItem(PL_TOKEN_KEY, loginRes.accessToken);
      localStorage.setItem(PL_USER_KEY, JSON.stringify(loginRes.user));
      setUser(loginRes.user);
      setSignerName(loginRes.user.displayName ?? '');
      lastInteraction.current = Date.now();
      setState('list');
      loadSheets();
    } catch {
      setPinError(t.pinError);
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  // Load timesheets list
  const loadSheets = useCallback(() => {
    if (!config) return;
    setSheetsLoading(true);
    plFetch<{ data: TimesheetListItem[] }>(
      `/timesheets?projectId=${config.projectId}&status=SUBMITTED&limit=100&sortBy=weekNumber&sortDir=desc`,
    )
      .then((res) => setSheets(res.data ?? []))
      .catch(() => setSheets([]))
      .finally(() => setSheetsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Load detail
  const loadDetail = async (id: string) => {
    resetActivity();
    setDetailLoading(true);
    setSignError('');
    try {
      const sheet = await plFetch<TimesheetDetail>(`/timesheets/${id}`);
      setDetail(sheet);
      setState('detail');
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  // Sign and approve
  const handleSignAndApprove = async () => {
    if (!detail || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    if (!dataUrl) {
      setSignError(t.signatureEmpty);
      return;
    }
    if (!signerName.trim()) return;

    resetActivity();
    setSigning(true);
    setSignError('');
    try {
      await plFetch(`/timesheets/${detail.id}/sign`, {
        method: 'POST',
        body: {
          signerType: 'CUSTOMER',
          signerName: signerName.trim(),
          signerRole: 'Kunden-PL',
          signatureBase64: dataUrl,
        },
      });
      await plFetch(`/timesheets/${detail.id}/approve`, { method: 'POST' });
      setConfirmMessage(t.successMessage);
      setState('confirmation');
      setTimeout(resetToIdle, 4000);
    } catch {
      setSignError(t.errorGeneric);
    } finally {
      setSigning(false);
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

  // ── CONFIRMATION ──
  if (state === 'confirmation') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="text-8xl">✅</div>
        <p className="text-center text-3xl font-bold">{t.successTitle}</p>
        <p className="text-xl text-gray-400">{confirmMessage}</p>
      </div>
    );
  }

  // ── DETAIL ──
  if (state === 'detail' && detail) {
    const canApprove = detail.status === 'SUBMITTED';
    const hasCustomerSig = detail.signatures.some((s) => s.signerType === 'CUSTOMER');

    return (
      <div
        className="flex min-h-screen flex-col p-4"
        onClick={resetActivity}
        onTouchStart={resetActivity}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              resetActivity();
              setDetail(null);
              setState('list');
            }}
            className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
            style={{ minHeight: '44px' }}
          >
            ← {t.backToList}
          </button>
          <div className="text-right text-xl tabular-nums text-gray-400">{timeStr}</div>
        </div>

        {/* Title */}
        <h2 className="mt-4 text-2xl font-bold">
          KW {detail.weekNumber}/{detail.weekYear} · {detail.worker.firstName} {detail.worker.lastName}
        </h2>
        <p className="text-gray-400">{detail.project.title}</p>

        {/* Days table */}
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
                  <td className="px-3 py-2 text-right font-mono">{formatMinutes(day.grossMinutes)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMinutes(day.breakMinutes)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{formatMinutes(day.netMinutes)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-600 font-bold">
                <td colSpan={4} className="px-3 py-2">{t.totals}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(detail.totalMinutesGross)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(detail.totalBreakMinutes)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMinutes(detail.totalMinutesNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Existing signatures */}
        {detail.signatures.length > 0 && (
          <div className="mt-4 rounded-xl bg-gray-900/60 p-3">
            <h4 className="mb-2 text-sm font-medium text-gray-400">
              {tTimesheets.signatures.existing}
            </h4>
            {detail.signatures.map((sig) => (
              <p key={sig.id} className="text-sm text-gray-300">
                {tTimesheets.signerType[sig.signerType]}: {sig.signerName} · {formatDate(sig.signedAt)}
              </p>
            ))}
          </div>
        )}

        {/* Sign and approve section */}
        {canApprove && !hasCustomerSig ? (
          <div className="mt-6 space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-sm text-gray-400">{t.signerName}</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-lg text-white"
                style={{ minHeight: '44px' }}
              />
            </div>

            {/* Signature */}
            <div>
              <p className="mb-1 text-sm text-gray-400">{t.signatureHint}</p>
              <SignatureCanvas ref={canvasRef} height={160} className="border-gray-600 bg-gray-100" />
              <button
                onClick={() => canvasRef.current?.clear()}
                className="mt-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
                style={{ minHeight: '44px' }}
              >
                {t.clearSignature}
              </button>
            </div>

            {signError && (
              <p className="text-red-400">{signError}</p>
            )}

            <button
              onClick={handleSignAndApprove}
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

        {/* Auto-logout */}
        {countdown > 0 && countdown <= 30 && (
          <div className="fixed bottom-2 left-0 right-0 text-center text-xs text-gray-500">
            {t.autoLogout(countdown)}
          </div>
        )}
      </div>
    );
  }

  // ── LIST ──
  if (state === 'list' && user) {
    return (
      <div
        className="flex min-h-screen flex-col p-4"
        onClick={resetActivity}
        onTouchStart={resetActivity}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={resetToIdle}
            className="rounded-lg bg-gray-800 px-4 py-2 text-lg text-gray-300 transition hover:bg-gray-700"
            style={{ minHeight: '44px' }}
          >
            ← {t.back}
          </button>
          <div className="text-right text-xl tabular-nums text-gray-400">{timeStr}</div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h2 className="text-2xl font-bold">{t.listTitle}</h2>
          <p className="text-gray-400">{config.projectTitle}</p>
          <p className="text-sm text-gray-500">{user.displayName}</p>
        </div>

        {/* List */}
        <div className="mt-6 flex-1">
          {sheetsLoading ? (
            <p className="text-center text-gray-400">{texts.common.loading}</p>
          ) : sheets.length === 0 ? (
            <p className="text-center text-gray-500">{t.listEmpty}</p>
          ) : (
            <div className="space-y-3">
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => loadDetail(sheet.id)}
                  className="w-full rounded-xl bg-gray-900/80 p-4 text-left transition hover:bg-gray-800 active:scale-[0.98]"
                  style={{ minHeight: '64px' }}
                  disabled={detailLoading}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">
                        {sheet.worker.firstName} {sheet.worker.lastName}
                      </p>
                      <p className="text-sm text-gray-400">
                        {t.week} {sheet.weekNumber}/{sheet.weekYear}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-medium text-blue-400">
                        {formatMinutes(sheet.totalMinutesNet)}
                      </p>
                      <span className="inline-block rounded-full bg-yellow-600/30 px-2 py-0.5 text-xs font-medium text-yellow-300">
                        {tTimesheets.status[sheet.status] ?? sheet.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={() => {
              resetActivity();
              loadSheets();
            }}
            className="mx-auto mt-6 block rounded-lg bg-gray-800 px-6 py-3 text-gray-300 transition hover:bg-gray-700"
            style={{ minHeight: '44px' }}
          >
            {texts.customerPl.timesheets.reload}
          </button>
        </div>

        {/* Auto-logout */}
        {countdown > 0 && countdown <= 30 && (
          <div className="fixed bottom-2 left-0 right-0 text-center text-xs text-gray-500">
            {t.autoLogout(countdown)}
          </div>
        )}
      </div>
    );
  }

  // ── IDLE (PIN entry) ──
  return (
    <div className="flex min-h-screen flex-col p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <button
          onClick={() => setShowAdminDialog(true)}
          className="rounded-lg bg-gray-800/50 px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-700"
        >
          {texts.kiosk.terminal.setupButton}
        </button>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{timeStr}</div>
          <div className="text-sm text-gray-500">{dateStr}</div>
        </div>
      </div>

      {/* Project + mode title */}
      <div className="mt-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-blue-400">
          {t.modeLabel}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white lg:text-4xl">
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

        {pinError && <p className="mb-4 text-center text-red-400">{pinError}</p>}
        {pinLoading && <p className="mb-4 text-center text-blue-400">{texts.kiosk.terminal.pinChecking}</p>}

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
            {texts.kiosk.terminal.clear}
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
            {texts.kiosk.terminal.confirm}
          </button>
        </div>
      </div>

      {/* Admin PIN Dialog */}
      {showAdminDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-gray-900 p-6">
            <h3 className="text-xl font-bold">{texts.kiosk.terminal.adminPinPrompt}</h3>
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
                {texts.kiosk.terminal.back}
              </button>
              <button
                onClick={handleAdminPinConfirm}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-500"
              >
                {texts.kiosk.terminal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
