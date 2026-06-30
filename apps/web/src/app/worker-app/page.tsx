'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Delete } from 'lucide-react';
import {
  WORKER_TOKEN_KEY,
  getWorkerToken,
  setWorkerSession,
  workerApi,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';

const PIN_LENGTH = 6;

export default function WorkerPinPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.workerApp.pin;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bereits angemeldet? → direkt zum Dashboard.
  useEffect(() => {
    if (getWorkerToken()) {
      router.replace('/worker-app/dashboard');
    }
  }, [router]);

  const submit = useCallback(
    async (value: string) => {
      setSubmitting(true);
      setError(false);
      try {
        const res = await workerApi.pinLogin(value);
        // Token zuerst speichern, damit me() es nutzen kann.
        window.localStorage.setItem(WORKER_TOKEN_KEY, res.accessToken);
        const me = await workerApi.me();
        setWorkerSession(res.accessToken, me);
        router.replace('/worker-app/dashboard');
      } catch {
        // Ungültige PIN oder Netzwerkfehler → zurücksetzen.
        setError(true);
        setPin('');
        setSubmitting(false);
      }
    },
    [router],
  );

  const press = (digit: string): void => {
    if (submitting) return;
    setError(false);
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) {
        void submit(next);
      }
      return next;
    });
  };

  const backspace = (): void => {
    if (submitting) return;
    setError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const clear = (): void => {
    if (submitting) return;
    setError(false);
    setPin('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Clock className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* PIN-Punkte */}
      <div className="flex items-center gap-3" aria-label={t.hint}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              i < pin.length
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/40',
              error && 'border-destructive',
            )}
          />
        ))}
      </div>

      <p
        className={cn(
          'h-5 text-sm',
          error ? 'text-destructive' : 'text-transparent',
        )}
      >
        {error ? t.error : '·'}
      </p>

      {/* Nummernpad – Tasten ≥ 80px */}
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <PadButton key={k} onClick={() => press(k)} disabled={submitting}>
            {k}
          </PadButton>
        ))}
        <PadButton variant="muted" onClick={clear} disabled={submitting}>
          C
        </PadButton>
        <PadButton onClick={() => press('0')} disabled={submitting}>
          0
        </PadButton>
        <PadButton
          variant="muted"
          onClick={backspace}
          disabled={submitting}
          aria-label={t.backspace}
        >
          <Delete className="h-7 w-7" />
        </PadButton>
      </div>

      <p className="h-5 text-sm text-muted-foreground">
        {submitting ? t.submitting : ''}
      </p>
    </div>
  );
}

function PadButton({
  children,
  onClick,
  disabled,
  variant = 'default',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'muted';
  'aria-label'?: string;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold transition-colors active:scale-95 disabled:opacity-50',
        variant === 'default'
          ? 'bg-muted text-foreground hover:bg-accent'
          : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}
