'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import { settingsApi, type StorageConfig } from '@/lib/settings';
import { texts } from '@/lib/texts';

export default function StorageSettingsPage(): React.ReactNode {
  const t = texts.settings.storage;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [impersonateEmail, setImpersonateEmail] = useState('');

  useEffect(() => {
    settingsApi
      .getStorageConfig()
      .then((cfg) => {
        setEnabled(cfg.enabled);
        setFolderId(cfg.folderId);
        setServiceAccountJson(cfg.serviceAccountJson);
        setImpersonateEmail(cfg.impersonateEmail);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveStorageConfig({
        enabled,
        folderId,
        serviceAccountJson,
        impersonateEmail,
      });
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
      const result = await settingsApi.testStorageConnection();
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

          {enabled && (
            <>
              <div className="space-y-1.5">
                <Label>{t.folderId}</Label>
                <Input
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder={t.folderIdPlaceholder}
                  className="min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.serviceAccountJson}</Label>
                <textarea
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  placeholder={t.serviceAccountPlaceholder}
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Delegation (E-Mail des Drive-Besitzers)</Label>
                <Input
                  value={impersonateEmail}
                  onChange={(e) => setImpersonateEmail(e.target.value)}
                  placeholder="z.B. vivahome@vivahome.de"
                  className="min-h-[44px]"
                  type="email"
                />
                <p className="text-xs text-muted-foreground">
                  Der Service Account handelt im Auftrag dieses Benutzers. Erforderlich, damit Dateien hochgeladen werden können (Service Accounts haben kein eigenes Speicherkontingent).
                </p>
              </div>

              <p className="text-sm text-muted-foreground">{t.info}</p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={testing || !folderId.trim() || !serviceAccountJson.trim()}
                  onClick={handleTest}
                >
                  {testing ? t.testing : t.testConnection}
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-end">
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
