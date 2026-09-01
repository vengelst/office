'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { texts } from '@/lib/texts';
import { kioskDebugLog } from '@/lib/kiosk-debug';
import type { SignatureCanvasHandle } from '@/components/timesheets/signature-canvas';
import {
  type TimesheetDetail,
  type TimesheetListItem,
} from '@/lib/timesheets';
import {
  KIOSK_PL_TOKEN_KEY,
  KIOSK_PL_USER_KEY,
  kioskPlApi,
  kioskPlFetch,
} from '@/lib/kiosk-pl-api';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import type { AuthUser, LoginResponse } from '@office/types';
import {
  KIOSK_CONFIG_KEY,
  PL_IDLE_SECONDS,
  PL_ITEMS_IDLE_SECONDS,
  type MainTab,
  type PlState,
} from './types';
import {
  DEFAULT_PIN_LENGTH,
  kioskSettingsApi,
} from '@/lib/kiosk-settings';

export function useKioskPl() {
  const router = useRouter();
  const t = texts.kiosk.pl;

  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [state, setState] = useState<PlState>('idle');
  const [mainTab, setMainTab] = useState<MainTab>('timesheets');
  const [itemBased, setItemBased] = useState(false);
  const [clock, setClock] = useState(new Date());

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);

  const [user, setUser] = useState<AuthUser | null>(null);

  const [sheets, setSheets] = useState<TimesheetListItem[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  const [detail, setDetail] = useState<TimesheetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  const [confirmMessage, setConfirmMessage] = useState('');

  const [countdown, setCountdown] = useState(0);
  const lastInteraction = useRef(Date.now());
  const wantFullscreen = useRef(false);

  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');

  useEffect(() => {
    void kioskSettingsApi.getPublic().then((cfg) => {
      setPinLength(cfg.pinLength);
    });
  }, []);

  useEffect(() => {
    kioskDebugLog('mount', 'PL mount');
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
        kioskDebugLog('nav', 'PL → terminal');
        router.replace('/kiosk/terminal');
        return;
      }
      setConfig(c);
      wantFullscreen.current = Boolean(c.fullscreen);
    } catch {
      router.replace('/kiosk/setup');
    }
    return () => kioskDebugLog('mount', 'PL unmount');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount
  }, []);

  const tryEnterFullscreen = useCallback(() => {
    if (!wantFullscreen.current) return;
    if (typeof document === 'undefined' || document.fullscreenElement) return;
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const resetToIdle = useCallback(() => {
    setState('idle');
    setUser(null);
    setPin('');
    setPinError('');
    setSheets([]);
    setDetail(null);
    setSignerName('');
    setSignError('');
    setItemBased(false);
    setMainTab('timesheets');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KIOSK_PL_TOKEN_KEY);
      localStorage.removeItem(KIOSK_PL_USER_KEY);
    }
  }, []);

  useEffect(() => {
    if (state === 'idle' || state === 'confirmation' || !config) return;
    const base = Math.max(config.autoLogoutSeconds, PL_IDLE_SECONDS);
    const limit =
      mainTab === 'items' ? Math.max(base, PL_ITEMS_IDLE_SECONDS) : base;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastInteraction.current) / 1000);
      const remaining = Math.max(0, limit - elapsed);
      setCountdown(remaining);
      if (remaining === 0) resetToIdle();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, config, mainTab]);

  const resetActivity = useCallback(() => {
    lastInteraction.current = Date.now();
  }, []);

  const loadSheets = useCallback(() => {
    if (!config) return;
    setSheetsLoading(true);
    kioskPlFetch<{ data: TimesheetListItem[] }>(
      `/timesheets?projectId=${config.projectId}&status=SUBMITTED&limit=100&sortBy=weekNumber&sortDir=desc`,
    )
      .then((res) => setSheets(res.data ?? []))
      .catch(() => setSheets([]))
      .finally(() => setSheetsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const submitPin = async (pinValue: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const loginRes = await kioskPlFetch<LoginResponse>('/auth/user-pin-login', {
        method: 'POST',
        body: { pin: pinValue },
      });
      localStorage.setItem(KIOSK_PL_TOKEN_KEY, loginRes.accessToken);
      localStorage.setItem(KIOSK_PL_USER_KEY, JSON.stringify(loginRes.user));
      setUser(loginRes.user);
      setSignerName(loginRes.user.displayName ?? '');
      lastInteraction.current = Date.now();

      let based = false;
      try {
        const projects = await kioskPlApi.projects();
        const match = projects.find((p) => p.id === config?.projectId);
        based = Boolean(match?.itemBased);
      } catch {
        based = false;
      }
      setItemBased(based);
      setMainTab(based ? 'items' : 'timesheets');
      setState('home');
      loadSheets();
    } catch {
      setPinError(t.pinError);
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= pinLength) return;
    const newPin = pin + digit;
    setPin(newPin);
    setPinError('');
    if (newPin.length === pinLength) void submitPin(newPin);
  };

  const handlePinClear = () => {
    setPin('');
    setPinError('');
  };

  const loadDetail = async (id: string) => {
    resetActivity();
    setDetailLoading(true);
    setSignError('');
    try {
      const sheet = await kioskPlFetch<TimesheetDetail>(`/timesheets/${id}`);
      setDetail(sheet);
      setState('timesheet_detail');
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSignAndApprove = async (
    canvasRef: RefObject<SignatureCanvasHandle | null>,
  ) => {
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
      await kioskPlFetch(`/timesheets/${detail.id}/sign`, {
        method: 'POST',
        body: {
          signerType: 'CUSTOMER',
          signerName: signerName.trim(),
          signerRole: 'Kunden-PL',
          signatureBase64: dataUrl,
        },
      });
      await kioskPlFetch(`/timesheets/${detail.id}/approve`, { method: 'POST' });
      setConfirmMessage(t.successMessage);
      setState('confirmation');
      setTimeout(resetToIdle, 4000);
    } catch {
      setSignError(t.errorGeneric);
    } finally {
      setSigning(false);
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

  const handleDetailBack = () => {
    resetActivity();
    setDetail(null);
    setState('home');
    setMainTab('timesheets');
  };

  const timeStr = clock.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = clock.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    config,
    state,
    mainTab,
    itemBased,
    pin,
    pinError,
    pinLoading,
    pinLength,
    user,
    sheets,
    sheetsLoading,
    detail,
    detailLoading,
    signerName,
    signing,
    signError,
    confirmMessage,
    countdown,
    showAdminDialog,
    adminPinInput,
    timeStr,
    dateStr,
    tryEnterFullscreen,
    resetActivity,
    resetToIdle,
    setMainTab,
    setSignerName,
    setShowAdminDialog,
    setAdminPinInput,
    handlePinDigit,
    handlePinClear,
    submitPin,
    loadSheets,
    loadDetail,
    handleSignAndApprove,
    handleAdminPinConfirm,
    handleDetailBack,
  };
}
