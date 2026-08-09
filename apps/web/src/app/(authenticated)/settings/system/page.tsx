/**
 * Seite: settings / system (Office-Web).
 * Orchestriert Laden/Refresh; Darstellung in SystemDashboard.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';
import {
  fetchSystemInfo,
  triggerPackageUpdate,
  type SystemInfo,
} from '@/lib/system-info';
import { SystemDashboard } from '@/components/settings/system/system-dashboard';

const t = texts.settings.system;

/**
 * UI-Komponente `SystemPage`.
 */
export default function SystemPage() {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const info = await fetchSystemInfo();
      setData(info);
      setLastUpdated(
        new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = () => {
    setLoading(true);
    void load();
  };

  const handleUpdate = async () => {
    setConfirmOpen(false);
    setUpdating(true);
    try {
      await triggerPackageUpdate();
      await load();
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !data) {
    return (
      <div>
        <PageHeader title={t.title} description={t.subtitle} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title={t.title} description={t.subtitle} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{t.error}</p>
            <p className="text-xs text-destructive">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <SystemDashboard
      data={data}
      lastUpdated={lastUpdated}
      loading={loading}
      updating={updating}
      confirmOpen={confirmOpen}
      setConfirmOpen={setConfirmOpen}
      onRefresh={handleRefresh}
      onUpdate={() => void handleUpdate()}
    />
  );
}
