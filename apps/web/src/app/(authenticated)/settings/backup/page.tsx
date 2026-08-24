/**
 * Seite: settings / backup (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, DatabaseBackup, Play, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  BACKUP_MODULE_LABELS,
  backupsApi,
  type BackupConfig,
  type BackupJob,
  type RestoreLog,
} from '@/lib/backups';
import { formatDateTime } from '@/lib/format';
import { texts } from '@/lib/texts';

const MODULES = Object.keys(BACKUP_MODULE_LABELS);

/**
 * UI-Komponente `BackupSettingsPage`.
 */
export default function BackupSettingsPage(): React.ReactNode {
  const t = texts.settings.backup;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [restores, setRestores] = useState<RestoreLog[]>([]);

  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(2);
  const [minute, setMinute] = useState(0);
  const [retention, setRetention] = useState(14);

  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([...MODULES]);
  const [restoring, setRestoring] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      backupsApi.getConfig(),
      backupsApi.listJobs(),
      backupsApi.listRestores(),
    ])
      .then(([cfg, jobList, restoreList]) => {
        setConfig(cfg);
        setEnabled(cfg.enabled);
        setHour(cfg.scheduleHour);
        setMinute(cfg.scheduleMinute);
        setRetention(cfg.retentionDays);
        setJobs(jobList);
        setRestores(restoreList);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const cfg = await backupsApi.updateConfig({
        enabled,
        scheduleHour: hour,
        scheduleMinute: minute,
        retentionDays: retention,
      });
      setConfig(cfg);
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

  const handleBackup = async (): Promise<void> => {
    setRunning(true);
    try {
      const job = await backupsApi.startBackup();
      toast({
        description:
          job.status === 'SUCCESS' ? t.toast.backupOk : t.toast.backupFailed,
        variant: job.status === 'SUCCESS' ? 'default' : 'destructive',
      });
      load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    if (!restoreJobId || selectedModules.length === 0) return;
    setRestoring(true);
    try {
      const log = await backupsApi.restore(restoreJobId, selectedModules);
      toast({
        description:
          log.status === 'SUCCESS'
            ? t.toast.restoreOk
            : log.status === 'PARTIAL'
              ? t.toast.restorePartial
              : t.toast.restoreFailed,
        variant: log.status === 'FAILED' ? 'destructive' : 'default',
      });
      setRestoreJobId(null);
      load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    try {
      await backupsApi.deleteJob(deleteId);
      toast({ description: t.toast.deleted });
      setDeleteId(null);
      load();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  const toggleModule = (mod: string): void => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
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
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          {texts.settings.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{t.title}</span>
      </nav>

      <PageHeader title={t.title} description={t.subtitle}>
        <Button
          className="min-h-[44px]"
          onClick={handleBackup}
          disabled={running}
        >
          <DatabaseBackup className="h-4 w-4" />
          {running ? t.running : t.startBackup}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold">{t.scheduleTitle}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            {t.enabled}
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t.hour}</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.minute}</Label>
              <Input
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.retentionDays}</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px]"
          >
            {saving ? t.saving : t.save}
          </Button>
          <p className="text-xs text-muted-foreground">{t.scheduleHint}</p>
          {config && (
            <p className="text-xs text-muted-foreground">
              {t.lastUpdated}: {formatDateTime(config.updatedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">{t.jobsTitle}</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noJobs}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.created}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.trigger}</TableHead>
                  <TableHead>{t.columns.size}</TableHead>
                  <TableHead className="text-right">{t.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(job.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.trigger === 'cron' ? t.triggerCron : t.triggerManual}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.fileSize != null
                        ? `${Math.round(job.fileSize / 1024)} KB`
                        : '–'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {job.status === 'SUCCESS' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => {
                              setSelectedModules([...MODULES]);
                              setRestoreJobId(job.id);
                            }}
                          >
                            <Play className="h-4 w-4" />
                            {t.restore}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] text-destructive"
                          onClick={() => setDeleteId(job.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {restores.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-sm font-semibold">{t.restoresTitle}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.created}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.modules}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restores.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {(Array.isArray(r.modules) ? r.modules : [])
                        .map((m) => BACKUP_MODULE_LABELS[m] ?? m)
                        .join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!restoreJobId}
        onOpenChange={(open) => {
          if (!open) setRestoreJobId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.restoreTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t.restoreConfirm}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODULES.map((mod) => (
              <label key={mod} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedModules.includes(mod)}
                  onChange={() => toggleModule(mod)}
                  className="h-4 w-4"
                />
                {BACKUP_MODULE_LABELS[mod]}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setRestoreJobId(null)}
            >
              {texts.customers.actions.cancel}
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={restoring || selectedModules.length === 0}
              onClick={handleRestore}
            >
              {restoring ? t.restoring : t.restore}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.ReactNode {
  return (
    <Badge variant={status === 'FAILED' ? 'outline' : 'secondary'}>
      {status}
    </Badge>
  );
}
