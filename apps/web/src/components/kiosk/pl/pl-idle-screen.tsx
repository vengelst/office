'use client';

import { texts } from '@/lib/texts';
import type { KioskConfig } from '@/app/kiosk/setup/page';
import { PlAdminPinDialog } from './pl-admin-pin-dialog';

interface PlIdleScreenProps {
  config: KioskConfig;
  pin: string;
  pinError: string;
  pinLoading: boolean;
  pinLength: number;
  timeStr: string;
  dateStr: string;
  showAdminDialog: boolean;
  adminPinInput: string;
  onPointerDown: () => void;
  setShowAdminDialog: (show: boolean) => void;
  setAdminPinInput: (value: string) => void;
  handlePinDigit: (digit: string) => void;
  handlePinClear: () => void;
  submitPin: (pin: string) => Promise<void>;
  handleAdminPinConfirm: () => void;
}

export function PlIdleScreen({
  config,
  pin,
  pinError,
  pinLoading,
  pinLength,
  timeStr,
  dateStr,
  showAdminDialog,
  adminPinInput,
  onPointerDown,
  setShowAdminDialog,
  setAdminPinInput,
  handlePinDigit,
  handlePinClear,
  submitPin,
  handleAdminPinConfirm,
}: PlIdleScreenProps) {
  const t = texts.kiosk.pl;
  const tTerminal = texts.kiosk.terminal;

  return (
    <div
      className="flex min-h-screen flex-col p-6"
      onPointerDown={onPointerDown}
    >
      <div className="flex items-start justify-between">
        <button
          onClick={() => setShowAdminDialog(true)}
          className="rounded-lg bg-gray-800/50 px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-700"
        >
          {tTerminal.setupButton}
        </button>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{timeStr}</div>
          <div className="text-sm text-gray-500">{dateStr}</div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-blue-400">
          {t.modeLabel}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white lg:text-4xl">
          {config.projectTitle}
        </h1>
      </div>

      <div className="mx-auto mt-8 w-full max-w-sm">
        <p className="mb-4 text-center text-lg text-gray-400">{t.pinTitle}</p>

        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: pinLength }).map((_, i) => (
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
        {pinLoading && (
          <p className="mb-4 text-center text-blue-400">{tTerminal.pinChecking}</p>
        )}

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
            {tTerminal.clear}
          </button>
          <button
            onClick={() => handlePinDigit('0')}
            disabled={pinLoading}
            className="flex h-20 items-center justify-center rounded-xl bg-gray-800 text-3xl font-bold text-white transition hover:bg-gray-700 active:scale-95 disabled:opacity-50 lg:h-24 lg:text-4xl"
          >
            0
          </button>
          <button
            onClick={() => pin.length === pinLength && void submitPin(pin)}
            disabled={pin.length < pinLength || pinLoading}
            className="flex h-20 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-40 lg:h-24"
          >
            {tTerminal.confirm}
          </button>
        </div>
      </div>

      {showAdminDialog && (
        <PlAdminPinDialog
          adminPinInput={adminPinInput}
          onAdminPinInputChange={setAdminPinInput}
          onConfirm={handleAdminPinConfirm}
          onCancel={() => {
            setShowAdminDialog(false);
            setAdminPinInput('');
          }}
        />
      )}
    </div>
  );
}
