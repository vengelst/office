/**
 * Seite: Einstellungen → KI / Assistent
 */

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
import { aiSettingsApi } from '@/lib/ai-import';
import { texts } from '@/lib/texts';

export default function AiSettingsPage(): React.ReactNode {
  const t = texts.settings.ai;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [apiKey, setApiKey] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(120000);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState('');

  useEffect(() => {
    aiSettingsApi
      .get()
      .then((cfg) => {
        setEnabled(cfg.enabled);
        setBaseUrl(cfg.baseUrl || 'https://api.openai.com/v1');
        setModel(cfg.model || 'gpt-4.1-mini');
        setTimeoutMs(cfg.timeoutMs || 120000);
        setApiKeyConfigured(cfg.apiKeyConfigured);
        setApiKeyMasked(cfg.apiKeyMasked);
        setApiKey('');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await aiSettingsApi.save({
        enabled,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        timeoutMs,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      const refreshed = await aiSettingsApi.get();
      setApiKeyConfigured(refreshed.apiKeyConfigured);
      setApiKeyMasked(refreshed.apiKeyMasked);
      setApiKey('');
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
      const result = await aiSettingsApi.test();
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            {t.enabled}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.baseUrl}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t.baseUrlPlaceholder}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.model}</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t.modelPlaceholder}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.timeoutMs}</Label>
              <Input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value) || 120000)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.apiKey}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiKeyConfigured
                    ? `${apiKeyMasked} · ${t.apiKeyPlaceholder}`
                    : t.apiKeyPlaceholder
                }
                className="min-h-[44px]"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                {apiKeyConfigured ? t.apiKeyConfigured : t.apiKeyMissing}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t.info}</p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={testing || !apiKeyConfigured}
              onClick={handleTest}
            >
              {testing ? t.testing : t.testConnection}
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={saving || !baseUrl.trim() || !model.trim()}
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
