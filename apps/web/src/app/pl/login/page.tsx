'use client';

/**
 * Mobiler PIN-Login für CUSTOMER_PL ohne Kiosk-Setup (#37).
 * Nutzt POST /auth/user-pin-login und speichert die Office-Session.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Delete } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import {
  DEFAULT_PIN_LENGTH,
  kioskSettingsApi,
} from '@/lib/kiosk-settings';
import { homeRouteFor, isCustomerPl } from '@/lib/roles';
import { texts } from '@/lib/texts';
import { cn } from '@/lib/utils';
import type { LoginResponse } from '@office/types';

export default function CustomerPlPinLoginPage(): React.ReactNode {
  const router = useRouter();
  const { acceptSession, isAuthenticated, isLoading, user } = useAuth();
  const t = texts.customerPl.pinLogin;

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);

  useEffect(() => {
    void kioskSettingsApi.getPublic().then((cfg) => {
      setPinLength(cfg.pinLength);
    });
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(homeRouteFor(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  const submit = useCallback(
    async (value: string) => {
      setSubmitting(true);
      setError(false);
      try {
        const res = await apiClient.post<LoginResponse>(
          '/auth/user-pin-login',
          { pin: value },
          { skipAuth: true },
        );
        if (!isCustomerPl(res.user)) {
          setError(true);
          setPin('');
          setSubmitting(false);
          return;
        }
        acceptSession(res);
        router.replace(homeRouteFor(res.user));
      } catch {
        setError(true);
        setPin('');
        setSubmitting(false);
      }
    },
    [acceptSession, router],
  );

  const press = (digit: string): void => {
    if (submitting) return;
    setError(false);
    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      const next = prev + digit;
      if (next.length === pinLength) {
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/40 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ClipboardCheck className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="flex items-center gap-3" aria-label={t.hint}>
        {Array.from({ length: pinLength }).map((_, i) => (
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

      <div className="flex flex-col items-center gap-3 text-sm">
        <Link
          href="/login"
          className="min-h-[44px] px-2 py-2 text-primary underline-offset-4 hover:underline"
        >
          {t.emailLoginLink}
        </Link>
        <Link
          href="/worker-app"
          className="min-h-[44px] px-2 py-2 text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.workerAppLink}
        </Link>
      </div>
    </main>
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
