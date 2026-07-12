'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  Users,
  FolderKanban,
  Wrench,
  ListTodo,
  Clock,
  Server,
  Database,
  Container,
  Network,
  Shield,
  Package,
  MessageSquare,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';
import { texts } from '@/lib/texts';
import {
  fetchSystemInfo,
  triggerPackageUpdate,
  type SystemInfo,
} from '@/lib/system-info';

const t = texts.settings.system;

function ProgressBar({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const color =
    value > 80
      ? 'bg-red-500'
      : value > 50
        ? 'bg-yellow-500'
        : 'bg-green-500';

  return (
    <div className={`h-2 w-full rounded-full bg-muted ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
    />
  );
}

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

  const { system, database, storage, services, osUpdates, appStats } = data;
  const serviceList = [
    services.api,
    services.postgresql,
    services.minio,
    services.ocr,
    services.research,
  ];

  const cacheColor =
    database.cacheHitRatio === null
      ? 'secondary'
      : database.cacheHitRatio > 99
        ? 'default'
        : database.cacheHitRatio > 95
          ? 'secondary'
          : 'destructive';

  const totalContainerUpdates = osUpdates.container.count;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link
              href="/settings"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.backToSettings}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {lastUpdated && (
            <span>
              {t.lastUpdated}: {lastUpdated}
            </span>
          )}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`}
            />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{appStats.customers}</p>
              <p className="text-xs text-muted-foreground">
                {t.summary.customers}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{appStats.projects}</p>
              <p className="text-xs text-muted-foreground">
                {t.summary.projects}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{appStats.workers}</p>
              <p className="text-xs text-muted-foreground">
                {t.summary.workers}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{appStats.openTodos}</p>
              <p className="text-xs text-muted-foreground">
                {t.summary.openTasks}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{system.uptime}</p>
              <p className="text-xs text-muted-foreground">
                {t.summary.uptime}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CPU / RAM / Disk */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              {t.cpu.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.cpu.usage}</span>
              <span className="font-medium">{system.cpu.usagePercent}%</span>
            </div>
            <ProgressBar value={system.cpu.usagePercent} />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                {t.cpu.cores}: {system.cpu.cores}
              </div>
              <div>
                {t.cpu.loadAvg}: {system.cpu.loadAvg.join(' / ')}
              </div>
              <div className="truncate" title={system.cpu.model}>
                {system.cpu.model}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="h-4 w-4" />
              {t.memory.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.memory.used}</span>
              <span className="font-medium">
                {system.memory.usagePercent}%
              </span>
            </div>
            <ProgressBar value={system.memory.usagePercent} />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                {t.memory.total}: {system.memory.total}
              </div>
              <div>
                {t.memory.used}: {system.memory.used}
              </div>
              <div>
                {t.memory.free}: {system.memory.free}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              {t.disk.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.disk.used}</span>
              <span className="font-medium">{system.disk.usagePercent}%</span>
            </div>
            <ProgressBar value={system.disk.usagePercent} />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                {t.disk.total}: {system.disk.total}
              </div>
              <div>
                {t.disk.used}: {system.disk.used}
              </div>
              <div>
                {t.disk.available}: {system.disk.available}
              </div>
            </div>
            {system.disk.breakdown && system.disk.breakdown.length > 0 && (
              <div className="border-t pt-3 mt-3 space-y-1.5">
                <p className="text-xs font-medium mb-2">Speicher-Aufteilung</p>
                {system.disk.breakdown.map((item) => {
                  const totalBytes = system.disk.breakdown.reduce((s, b) => s + b.sizeBytes, 0);
                  const pct = totalBytes > 0 ? Math.round((item.sizeBytes / totalBytes) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono">{item.size} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${item.label === 'Frei' ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {database.size !== 'N/A' && (
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">PostgreSQL Datenbank</span>
                    <span className="font-mono">{database.size}</span>
                  </div>
                )}
                {storage.available && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">MinIO Storage</span>
                    <span className="font-mono">{storage.totalSize}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Health + OS Updates */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t.services.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceList.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot online={svc.status === 'online'} />
                    <span className="text-sm font-medium">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.status === 'online' ? (
                      <>
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                        >
                          {t.services.online}
                        </Badge>
                        {svc.responseTime != null && (
                          <span className="text-xs text-muted-foreground">
                            {svc.responseTime} {t.services.responseTime}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Badge variant="destructive">
                          {t.services.offline}
                        </Badge>
                        {svc.error && (
                          <span
                            className="text-xs text-destructive truncate max-w-[150px]"
                            title={svc.error}
                          >
                            {svc.error}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              {t.updates.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {t.updates.containerUpdates}
                </span>
                {totalContainerUpdates > 0 ? (
                  <Badge variant="secondary">
                    {t.updates.packagesAvailable(totalContainerUpdates)}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                  >
                    {t.updates.noUpdates}
                  </Badge>
                )}
              </div>
              {osUpdates.container.packages.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs font-mono space-y-0.5">
                  {osUpdates.container.packages.map((pkg, i) => (
                    <div key={i} className="text-muted-foreground">
                      {pkg}
                    </div>
                  ))}
                </div>
              )}
              {totalContainerUpdates > 0 && (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      {t.updates.installing}
                    </>
                  ) : (
                    t.updates.installButton
                  )}
                </Button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t.updates.hostUpdates}
                </span>
                {osUpdates.host.available ? (
                  osUpdates.host.count > 0 ? (
                    <Badge variant="secondary">
                      {t.updates.packagesAvailable(osUpdates.host.count)}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                    >
                      {t.updates.noUpdates}
                    </Badge>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t.updates.hostNotAvailable}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PostgreSQL + MinIO */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              {t.database.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t.database.size}
                </p>
                <p className="text-lg font-semibold">{database.size}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t.database.connections}
                </p>
                <p className="text-lg font-semibold">
                  {database.activeConnections}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    {t.database.activeOf} {database.maxConnections}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t.database.cacheHitRatio}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={cacheColor as 'default' | 'secondary' | 'destructive'}>
                    {database.cacheHitRatio != null
                      ? `${database.cacheHitRatio}%`
                      : 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t.database.version}
                </p>
                <p
                  className="text-xs font-medium truncate"
                  title={database.version}
                >
                  {database.version.split(' ').slice(0, 2).join(' ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Container className="h-4 w-4" />
              {t.storage.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {storage.available ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.storage.totalSize}
                    </p>
                    <p className="text-lg font-semibold">
                      {storage.totalSize}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.storage.totalObjects}
                    </p>
                    <p className="text-lg font-semibold">
                      {storage.totalObjects}
                    </p>
                  </div>
                </div>
                {storage.buckets.length > 0 && (
                  <div className="rounded border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-1.5 text-left font-medium">
                            {t.storage.bucketName}
                          </th>
                          <th className="px-3 py-1.5 text-right font-medium">
                            {t.storage.bucketObjects}
                          </th>
                          <th className="px-3 py-1.5 text-right font-medium">
                            {t.storage.bucketSize}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {storage.buckets.map((b) => (
                          <tr key={b.name} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-mono">
                              {b.name}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {b.objects}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {b.size}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t.storage.unavailable}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Network + Server Details */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4" />
              {t.network.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {system.network.length > 0 ? (
              <div className="rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-1.5 text-left font-medium">
                        {t.network.interface}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        {t.network.received}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        {t.network.sent}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {system.network.map((n) => (
                      <tr key={n.name} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-mono">{n.name}</td>
                        <td className="px-3 py-1.5 text-right">{n.rx}</td>
                        <td className="px-3 py-1.5 text-right">{n.tx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Netzwerkdaten verfügbar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              {t.serverDetails.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.serverDetails.hostname}
                </span>
                <span className="font-mono font-medium">
                  {system.server.hostname}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.serverDetails.platform}
                </span>
                <span className="font-medium">{system.server.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.serverDetails.arch}
                </span>
                <span className="font-medium">{system.server.arch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.serverDetails.nodeVersion}
                </span>
                <span className="font-mono font-medium">
                  {system.server.nodeVersion}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Processes + Top DB Tables */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              {t.processes.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {system.processes.length > 0 ? (
              <div className="rounded border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t.processes.pid}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t.processes.user}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t.processes.cpu}
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium">
                        {t.processes.mem}
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium">
                        {t.processes.command}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {system.processes.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1 font-mono">{p.pid}</td>
                        <td className="px-2 py-1">{p.user}</td>
                        <td className="px-2 py-1 text-right">{p.cpu}</td>
                        <td className="px-2 py-1 text-right">{p.mem}</td>
                        <td
                          className="px-2 py-1 font-mono truncate max-w-[200px]"
                          title={p.command}
                        >
                          {p.command}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Prozessdaten verfügbar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              {t.database.topTables}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {database.tables.length > 0 ? (
              <div className="rounded border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-1.5 text-left font-medium">
                        {t.database.tableName}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        {t.database.tableSize}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        {t.database.tableRows}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {database.tables.map((tbl) => (
                      <tr
                        key={tbl.name}
                        className="border-b last:border-0"
                      >
                        <td className="px-3 py-1 font-mono">{tbl.name}</td>
                        <td className="px-3 py-1 text-right">{tbl.size}</td>
                        <td className="px-3 py-1 text-right">
                          {tbl.rows.toLocaleString('de-DE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Tabellendaten verfügbar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* App Stats + OS Users */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              {t.appStats.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.appStats.communication}
                </span>
                <span className="font-medium">
                  {appStats.communicationRecent}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.appStats.documents}
                </span>
                <span className="font-medium">{appStats.documents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.appStats.equipmentAssigned}
                </span>
                <span className="font-medium">
                  {appStats.equipment.assigned}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.appStats.equipmentAvailable}
                </span>
                <span className="font-medium">
                  {appStats.equipment.available}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              {t.osUsers.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {system.osUsers.length > 0 ? (
              <div className="space-y-1">
                {system.osUsers.map((user, i) => (
                  <div
                    key={i}
                    className="text-sm font-mono bg-muted/50 rounded px-3 py-1"
                  >
                    {user}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Benutzerdaten verfügbar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-6">
        {t.autoRefresh}
      </p>

      {/* Update Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.updates.confirmTitle}</DialogTitle>
            <DialogDescription>{t.updates.confirmText}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              {t.updates.cancelButton}
            </Button>
            <Button onClick={handleUpdate}>{t.updates.confirmButton}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
