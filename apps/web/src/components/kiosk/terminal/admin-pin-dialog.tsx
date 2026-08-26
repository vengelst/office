'use client';

import { KT } from '@/lib/texts/kiosk-terminal-i18n';
import type { TerminalTranslate } from './types';

interface AdminPinDialogProps {
  adminPinInput: string;
  onAdminPinInputChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  t: TerminalTranslate;
}

export function AdminPinDialog({
  adminPinInput,
  onAdminPinInputChange,
  onConfirm,
  onCancel,
  t,
}: AdminPinDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-gray-900 p-6">
        <h3 className="text-xl font-bold">{t(KT.adminPinPrompt)}</h3>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={adminPinInput}
          onChange={(e) => onAdminPinInputChange(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-700 py-3 text-gray-300 transition hover:bg-gray-600"
          >
            {t(KT.back)}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-500"
          >
            {t(KT.confirm)}
          </button>
        </div>
      </div>
    </div>
  );
}
