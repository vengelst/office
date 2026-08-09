/**
 * Seite: settings / features (Office-Web).
 * Feature-Flags für Kernmodule – Speichern nur SUPERADMIN.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ToggleLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_LABELS,
  featureFlagsApi,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@/lib/feature-flags';
import { useFeatureFlags } from '@/lib/feature-flags-context';
import { texts } from '@/lib/texts';

const FLAG_KEYS = Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[];

export default function FeatureFlagsSettingsPage(): React.ReactNode {
  const { user } = useAuth();
  const { refresh, setLocalFlags } = useFeatureFlags();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>({ ...DEFAULT_FEATURE_FLAGS });

  const isSuperadmin = Boolean(user?.roles?.includes('SUPERADMIN'));

  useEffect(() => {
    featureFlagsApi
      .get()
      .then((data) => setFlags({ ...DEFAULT_FEATURE_FLAGS, ...data }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: FeatureFlagKey): void => {
    if (!isSuperadmin) return;
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (): Promise<void> => {
    if (!isSuperadmin) return;
    setSaving(true);
    try {
      const saved = await featureFlagsApi.put(flags);
      setFlags(saved);
      setLocalFlags(saved);
      await refresh();
      toast({ description: texts.settings.features.toast.saved });
    } catch (err) {
      toast({
        variant: 'destructive',
        description:
          err instanceof ApiError
            ? err.message
            : texts.settings.features.toast.error,
      });
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {texts.settings.features.back}
        </Link>
        <PageHeader
          title={texts.settings.features.title}
          description={texts.settings.features.subtitle}
        />
      </div>

      {!isSuperadmin && (
        <p className="text-sm text-muted-foreground">
          {texts.settings.features.readOnlyHint}
        </p>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {FLAG_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm font-medium">
                {FEATURE_FLAG_LABELS[key]}
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={flags[key]}
                disabled={!isSuperadmin || saving}
                onChange={() => toggle(key)}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      {isSuperadmin && (
        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} disabled={saving}>
            <ToggleLeft className="mr-1.5 h-4 w-4" />
            {saving
              ? texts.settings.features.saving
              : texts.settings.features.save}
          </Button>
        </div>
      )}
    </div>
  );
}
