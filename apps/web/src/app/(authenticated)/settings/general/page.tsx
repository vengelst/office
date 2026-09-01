/**
 * Seite: settings / general (Office-Web).
 * Allgemeine Schalter – Kiosk-Debug, GPS, PIN-Länge, Arbeitszeit-Alarm.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  KeyRound,
  Mail,
  MapPin,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import {
  DEFAULT_OVERTIME_ALERT_HOURS,
  DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  DEFAULT_OVERTIME_ALERT_REMINDERS,
  DEFAULT_PIN_LENGTH,
  MAX_OVERTIME_ALERT_HOURS,
  MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  MAX_OVERTIME_ALERT_REMINDERS,
  MAX_PIN_LENGTH,
  MIN_OVERTIME_ALERT_HOURS,
  MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  MIN_OVERTIME_ALERT_REMINDERS,
  MIN_PIN_LENGTH,
  kioskSettingsApi,
} from '@/lib/kiosk-settings';
import { texts } from '@/lib/texts';

export default function GeneralSettingsPage(): React.ReactNode {
  const t = texts.settings.general;
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debugLogEnabled, setDebugLogEnabled] = useState(false);
  const [gpsIntervalMinutes, setGpsIntervalMinutes] = useState(20);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);
  const [overtimeAlertEmail, setOvertimeAlertEmail] = useState('');
  const [overtimeAlertHours, setOvertimeAlertHours] = useState(
    DEFAULT_OVERTIME_ALERT_HOURS,
  );
  const [overtimeAlertReminders, setOvertimeAlertReminders] = useState(
    DEFAULT_OVERTIME_ALERT_REMINDERS,
  );
  const [overtimeAlertReminderIntervalMinutes, setOvertimeAlertReminderIntervalMinutes] =
    useState(DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES);
  const [overtimeTesting, setOvertimeTesting] = useState(false);
  const [overtimeRunning, setOvertimeRunning] = useState(false);

  const canEdit = Boolean(
    user?.roles?.includes('SUPERADMIN') || user?.roles?.includes('OFFICE'),
  );

  useEffect(() => {
    kioskSettingsApi
      .getGeneral()
      .then((data) => {
        setDebugLogEnabled(data.debugLogEnabled);
        setGpsIntervalMinutes(data.gpsIntervalMinutes ?? 20);
        setPinLength(data.pinLength ?? DEFAULT_PIN_LENGTH);
        setOvertimeAlertEmail(data.overtimeAlertEmail ?? '');
        setOvertimeAlertHours(
          data.overtimeAlertHours ?? DEFAULT_OVERTIME_ALERT_HOURS,
        );
        setOvertimeAlertReminders(
          data.overtimeAlertReminders ?? DEFAULT_OVERTIME_ALERT_REMINDERS,
        );
        setOvertimeAlertReminderIntervalMinutes(
          data.overtimeAlertReminderIntervalMinutes ??
            DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
        );
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleOvertimeTest = async (): Promise<void> => {
    if (!canEdit) return;
    setOvertimeTesting(true);
    try {
      const result = await kioskSettingsApi.sendOvertimeAlertTest(
        overtimeAlertEmail.trim() || undefined,
      );
      if (result.success) {
        toast({
          description: `${t.toast.overtimeTestSent} (${result.to})`,
        });
      } else {
        toast({
          variant: 'destructive',
          description: result.error ?? t.toast.overtimeTestFailed,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.overtimeTestFailed,
      });
    } finally {
      setOvertimeTesting(false);
    }
  };

  const handleOvertimeRun = async (): Promise<void> => {
    if (!canEdit) return;
    setOvertimeRunning(true);
    try {
      // Zuerst speichern, damit Test die aktuellen Werte nutzt
      const hours = Math.min(
        MAX_OVERTIME_ALERT_HOURS,
        Math.max(MIN_OVERTIME_ALERT_HOURS, Math.round(overtimeAlertHours)),
      );
      const reminders = Math.min(
        MAX_OVERTIME_ALERT_REMINDERS,
        Math.max(
          MIN_OVERTIME_ALERT_REMINDERS,
          Math.round(overtimeAlertReminders),
        ),
      );
      const reminderInterval = Math.min(
        MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
        Math.max(
          MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
          Math.round(overtimeAlertReminderIntervalMinutes),
        ),
      );
      await kioskSettingsApi.putGeneral({
        debugLogEnabled,
        gpsIntervalMinutes: Math.min(
          240,
          Math.max(1, Math.round(gpsIntervalMinutes)),
        ),
        pinLength: Math.min(
          MAX_PIN_LENGTH,
          Math.max(MIN_PIN_LENGTH, Math.round(pinLength)),
        ),
        overtimeAlertEmail: overtimeAlertEmail.trim(),
        overtimeAlertHours: hours,
        overtimeAlertReminders: reminders,
        overtimeAlertReminderIntervalMinutes: reminderInterval,
      });
      const result = await kioskSettingsApi.runOvertimeAlertCheck();
      if (result.sent > 0) {
        toast({
          description: `${t.toast.overtimeRunDone} ${result.sent} Mail(s) an ${result.to}.`,
        });
      } else {
        toast({
          description: `${t.toast.overtimeRunNone} (${result.checked} offen, Schwelle ${result.alertHours}h).`,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setOvertimeRunning(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!canEdit) return;
    const interval = Math.min(240, Math.max(1, Math.round(gpsIntervalMinutes)));
    const length = Math.min(
      MAX_PIN_LENGTH,
      Math.max(MIN_PIN_LENGTH, Math.round(pinLength)),
    );
    const hours = Math.min(
      MAX_OVERTIME_ALERT_HOURS,
      Math.max(MIN_OVERTIME_ALERT_HOURS, Math.round(overtimeAlertHours)),
    );
    const reminders = Math.min(
      MAX_OVERTIME_ALERT_REMINDERS,
      Math.max(
        MIN_OVERTIME_ALERT_REMINDERS,
        Math.round(overtimeAlertReminders),
      ),
    );
    const reminderInterval = Math.min(
      MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
      Math.max(
        MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
        Math.round(overtimeAlertReminderIntervalMinutes),
      ),
    );
    setSaving(true);
    try {
      const saved = await kioskSettingsApi.putGeneral({
        debugLogEnabled,
        gpsIntervalMinutes: interval,
        pinLength: length,
        overtimeAlertEmail: overtimeAlertEmail.trim(),
        overtimeAlertHours: hours,
        overtimeAlertReminders: reminders,
        overtimeAlertReminderIntervalMinutes: reminderInterval,
      });
      setDebugLogEnabled(saved.debugLogEnabled);
      setGpsIntervalMinutes(saved.gpsIntervalMinutes);
      setPinLength(saved.pinLength);
      setOvertimeAlertEmail(saved.overtimeAlertEmail);
      setOvertimeAlertHours(saved.overtimeAlertHours);
      setOvertimeAlertReminders(saved.overtimeAlertReminders);
      setOvertimeAlertReminderIntervalMinutes(
        saved.overtimeAlertReminderIntervalMinutes,
      );
      toast({ description: t.toast.saved });
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.back}
        </Link>
        <PageHeader title={t.title} description={t.subtitle} />
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">{t.readOnly}</p>
      )}

      <Card>
        <CardContent className="space-y-6 py-5">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-sm">{t.kioskDebugTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.kioskDebugHint}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={debugLogEnabled}
                disabled={!canEdit}
                onChange={(e) => setDebugLogEnabled(e.target.checked)}
              />
              <span className="text-sm">
                {debugLogEnabled ? t.on : t.off}
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 border-t pt-5">
            <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">{t.gpsIntervalTitle}</p>
              <p className="text-xs text-muted-foreground">
                {t.gpsIntervalHint}
              </p>
              <div className="flex max-w-xs items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={240}
                  disabled={!canEdit}
                  value={gpsIntervalMinutes}
                  onChange={(e) =>
                    setGpsIntervalMinutes(Number(e.target.value) || 1)
                  }
                  className="min-h-[44px] w-28"
                />
                <span className="text-sm text-muted-foreground">
                  {t.gpsIntervalUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 border-t pt-5">
            <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">{t.pinLengthTitle}</p>
              <p className="text-xs text-muted-foreground">{t.pinLengthHint}</p>
              <div className="flex max-w-xs items-center gap-2">
                <select
                  disabled={!canEdit}
                  value={pinLength}
                  onChange={(e) => setPinLength(Number(e.target.value))}
                  className="min-h-[44px] w-28 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Array.from(
                    { length: MAX_PIN_LENGTH - MIN_PIN_LENGTH + 1 },
                    (_, i) => MIN_PIN_LENGTH + i,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">
                  {t.pinLengthUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 border-t pt-5">
            <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">{t.overtimeAlertTitle}</p>
              <p className="text-xs text-muted-foreground">
                {t.overtimeAlertHint}
              </p>
              <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    {t.overtimeAlertEmailLabel}
                  </label>
                  <Input
                    type="email"
                    disabled={!canEdit}
                    value={overtimeAlertEmail}
                    onChange={(e) => setOvertimeAlertEmail(e.target.value)}
                    placeholder={t.overtimeAlertEmailPlaceholder}
                    className="min-h-[44px]"
                    autoComplete="off"
                  />
                </div>
                <div className="w-full space-y-1.5 sm:w-36">
                  <label className="text-xs text-muted-foreground">
                    {t.overtimeAlertHoursLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_OVERTIME_ALERT_HOURS}
                      max={MAX_OVERTIME_ALERT_HOURS}
                      step={1}
                      disabled={!canEdit}
                      value={overtimeAlertHours}
                      onChange={(e) =>
                        setOvertimeAlertHours(
                          Number.parseInt(e.target.value, 10) ||
                            DEFAULT_OVERTIME_ALERT_HOURS,
                        )
                      }
                      className="min-h-[44px]"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {t.overtimeAlertHoursUnit}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.overtimeAlertHoursHint}
              </p>
              <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full space-y-1.5 sm:w-40">
                  <label className="text-xs text-muted-foreground">
                    {t.overtimeAlertRemindersLabel}
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={MIN_OVERTIME_ALERT_REMINDERS}
                    max={MAX_OVERTIME_ALERT_REMINDERS}
                    step={1}
                    disabled={!canEdit}
                    value={overtimeAlertReminders}
                    onChange={(e) =>
                      setOvertimeAlertReminders(
                        Number.parseInt(e.target.value, 10) ||
                          DEFAULT_OVERTIME_ALERT_REMINDERS,
                      )
                    }
                    className="min-h-[44px]"
                  />
                </div>
                <div className="w-full space-y-1.5 sm:w-44">
                  <label className="text-xs text-muted-foreground">
                    {t.overtimeAlertReminderIntervalLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES}
                      max={MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES}
                      step={1}
                      disabled={!canEdit}
                      value={overtimeAlertReminderIntervalMinutes}
                      onChange={(e) =>
                        setOvertimeAlertReminderIntervalMinutes(
                          Number.parseInt(e.target.value, 10) ||
                            DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
                        )
                      }
                      className="min-h-[44px]"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {t.overtimeAlertReminderIntervalUnit}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.overtimeAlertRemindersHint}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.overtimeAlertReminderIntervalHint}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.overtimeAlertOnceHint}
              </p>
              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={
                      overtimeTesting ||
                      overtimeRunning ||
                      !overtimeAlertEmail.trim()
                    }
                    onClick={() => void handleOvertimeTest()}
                  >
                    <Mail className="h-4 w-4" />
                    {overtimeTesting
                      ? t.overtimeAlertTesting
                      : t.overtimeAlertTestButton}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={
                      overtimeTesting ||
                      overtimeRunning ||
                      !overtimeAlertEmail.trim()
                    }
                    onClick={() => void handleOvertimeRun()}
                  >
                    <Play className="h-4 w-4" />
                    {overtimeRunning
                      ? t.overtimeAlertRunning
                      : t.overtimeAlertRunButton}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="min-h-[44px]"
        >
          {saving ? t.saving : t.save}
        </Button>
      )}
    </div>
  );
}
