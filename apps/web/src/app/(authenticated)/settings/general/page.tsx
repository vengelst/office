/**
 * Seite: settings / general (Office-Web).
 * Allgemeine Schalter – u. a. Kiosk-Debug-Log.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { kioskSettingsApi } from '@/lib/kiosk-settings';
import { texts } from '@/lib/texts';

export default function GeneralSettingsPage(): React.ReactNode {
  const t = texts.settings.general;
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debugLogEnabled, setDebugLogEnabled] = useState(false);

  const canEdit = Boolean(
    user?.roles?.includes('SUPERADMIN') || user?.roles?.includes('OFFICE'),
  );

  useEffect(() => {
    kioskSettingsApi
      .getGeneral()
      .then((data) => setDebugLogEnabled(data.debugLogEnabled))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const saved = await kioskSettingsApi.putGeneral({ debugLogEnabled });
      setDebugLogEnabled(saved.debugLogEnabled);
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
        <CardContent className="space-y-4 py-5">
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
