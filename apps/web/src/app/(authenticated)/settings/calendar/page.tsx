'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { settingsApi } from '@/lib/settings';
import { texts } from '@/lib/texts';

export default function CalendarSettingsPage(): React.ReactNode {
  const t = texts.settings.calendar;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [impersonateEmail, setImpersonateEmail] = useState('');

  useEffect(() => {
    settingsApi
      .getCalendarConfig()
      .then((cfg) => {
        setEnabled(cfg.enabled);
        setCredentialsConfigured(cfg.credentialsConfigured);
        setImpersonateEmail(cfg.impersonateEmail);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveCalendarConfig({ enabled });
      toast({ description: t.toast.saved });
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    try {
      const result = await settingsApi.testCalendarConnection();
      if (result.success) {
        toast({ description: t.toast.testSuccess });
      } else {
        toast({
          variant: 'destructive',
          description: result.error ?? t.toast.testFailed,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <Card>
        <CardContent className="space-y-6 pt-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            {t.enabled}
          </label>

          <div className="space-y-2 rounded-md border border-border p-4 text-sm">
            {credentialsConfigured ? (
              <>
                <p className="text-muted-foreground">{t.credentialsOk}</p>
                {impersonateEmail ? (
                  <p>
                    {t.impersonate}{' '}
                    <span className="font-medium">{impersonateEmail}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">{t.credentialsMissing}</p>
            )}
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/settings/storage">{t.openStorage}</Link>
            </Button>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t.setupTitle}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t.setupCalendarApi}</li>
              <li>{t.setupDwd}</li>
            </ol>
            <p>{t.note}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={testing || !credentialsConfigured}
              onClick={handleTest}
            >
              {testing ? t.testing : t.testConnection}
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
