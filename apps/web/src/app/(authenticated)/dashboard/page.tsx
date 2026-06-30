'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderKanban,
  HardHat,
  Clock,
  AlertTriangle,
  Timer,
  Receipt,
  FileWarning,
  Truck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { AvailabilityBadge } from '@/components/workers/worker-badges';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import {
  workersApi,
  type WorkerAvailability,
  type WorkerListItem,
} from '@/lib/workers';
import { timeEntriesApi } from '@/lib/timesheets';
import { formatCurrency, invoicesApi, type InvoiceStats } from '@/lib/invoices';
import { vehiclesApi, type VehicleListItem } from '@/lib/vehicles';
import { texts } from '@/lib/texts';

interface DashboardStats {
  customers: number;
  projects: number;
  workers: number;
  hoursThisWeek: number;
}

const cards = [
  { key: 'customers', label: texts.dashboard.cards.customers, icon: Users },
  { key: 'projects', label: texts.dashboard.cards.projects, icon: FolderKanban },
  { key: 'workers', label: texts.dashboard.cards.workers, icon: HardHat },
  { key: 'hours', label: texts.dashboard.cards.hours, icon: Clock },
] as const;

type CardKey = (typeof cards)[number]['key'];

function formatValue(key: CardKey, stats: DashboardStats): string {
  switch (key) {
    case 'customers':
      return String(stats.customers);
    case 'projects':
      return String(stats.projects);
    case 'workers':
      return String(stats.workers);
    case 'hours':
      return String(stats.hoursThisWeek);
  }
}

export default function DashboardPage(): React.ReactNode {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workers, setWorkers] = useState<WorkerListItem[] | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);
  const [clockedInCount, setClockedInCount] = useState<number | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [vehicles, setVehicles] = useState<VehicleListItem[] | null>(null);
  const [vehiclesExpiring, setVehiclesExpiring] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch(() => {});
    workersApi
      .list({ limit: 100 })
      .then((r) => setWorkers(r.data))
      .catch(() => setWorkers([]));
    workersApi
      .expiringDocuments()
      .then((r) => setExpiringCount(r.length))
      .catch(() => setExpiringCount(0));
    timeEntriesApi
      .live()
      .then((r) => setClockedInCount(r.length))
      .catch(() => setClockedInCount(0));
    invoicesApi
      .stats()
      .then(setInvoiceStats)
      .catch(() => setInvoiceStats(null));
    vehiclesApi
      .list({ limit: 100 })
      .then((r) => setVehicles(r.data))
      .catch(() => setVehicles([]));
    vehiclesApi
      .expiring()
      .then((r) => setVehiclesExpiring(r.length))
      .catch(() => setVehiclesExpiring(0));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={texts.dashboard.title}
        description={`${texts.dashboard.welcome}${
          user?.displayName ? `, ${user.displayName}` : ''
        }.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats ? formatValue(card.key, stats) : '—'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ClockedInCard
        count={clockedInCount}
        total={workers?.length ?? null}
      />

      <InvoicesWidget stats={invoiceStats} />

      <WorkersWidget workers={workers} expiringCount={expiringCount} />

      <VehiclesWidget vehicles={vehicles} expiringCount={vehiclesExpiring} />
    </div>
  );
}

function VehiclesWidget({
  vehicles,
  expiringCount,
}: {
  vehicles: VehicleListItem[] | null;
  expiringCount: number | null;
}): React.ReactNode {
  const t = texts.dashboard.vehicles;
  const total = vehicles?.length ?? null;
  const assigned =
    vehicles?.filter((v) => v.currentAssignment != null).length ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t.title}
        </CardTitle>
        <Link href="/vehicles" className="text-xs text-primary hover:underline">
          {t.viewAll}
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{total ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{t.total}</p>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold">{assigned ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{t.assigned}</p>
          </div>
          <div className="space-y-1">
            <div
              className={`flex items-center gap-1 text-2xl font-bold ${
                expiringCount
                  ? 'text-amber-600 dark:text-amber-400'
                  : ''
              }`}
            >
              {expiringCount ? (
                <Truck className="h-5 w-5 text-amber-500" />
              ) : null}
              {expiringCount ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {expiringCount && expiringCount > 0
                ? t.expiringTitle
                : t.expiringNone}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClockedInCard({
  count,
  total,
}: {
  count: number | null;
  total: number | null;
}): React.ReactNode {
  const t = texts.dashboard.clockedIn;
  return (
    <Link href="/time-clock/live" className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t.title}
          </CardTitle>
          <Timer className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {count === null ? '—' : count}
            {total !== null && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {total}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function InvoicesWidget({
  stats,
}: {
  stats: InvoiceStats | null;
}): React.ReactNode {
  const t = texts.dashboard.invoices;
  const overdue = stats?.outgoing.overdueCount ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Offene Ausgangsrechnungen */}
      <Link href="/invoices" className="block">
        <Card className="transition-colors hover:bg-accent/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.openTitle}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatCurrency(stats.outgoing.openAmount) : '—'}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats
                ? `${t.count(stats.outgoing.openCount)} · ${t.openSubtitle}`
                : t.openSubtitle}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Überfällige Rechnungen */}
      <Link href="/invoices" className="block">
        <Card className="transition-colors hover:bg-accent/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.overdueTitle}
            </CardTitle>
            <FileWarning
              className={`h-4 w-4 ${
                overdue ? 'text-red-500' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            {overdue === null ? (
              <div className="text-2xl font-bold">—</div>
            ) : overdue > 0 ? (
              <>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {overdue}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.overdueWarning(overdue)} ·{' '}
                  {formatCurrency(stats?.outgoing.overdueAmount)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">0</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.overdueNone}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

const ABSENT: WorkerAvailability[] = ['SICK', 'VACATION', 'UNAVAILABLE'];

function WorkersWidget({
  workers,
  expiringCount,
}: {
  workers: WorkerListItem[] | null;
  expiringCount: number | null;
}): React.ReactNode {
  const t = texts.dashboard.workers;

  const available = workers?.filter((w) => w.availability === 'AVAILABLE') ?? [];
  const onProject = workers?.filter((w) => w.availability === 'ON_PROJECT') ?? [];
  const absent = workers?.filter((w) => ABSENT.includes(w.availability)) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Verfügbarkeits-Verteilung */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t.title}
          </CardTitle>
          <Link
            href="/workers"
            className="text-xs text-primary hover:underline"
          >
            {t.viewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {workers === null ? (
            <p className="text-sm text-muted-foreground">
              {texts.common.loading}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Stat
                value={available.length}
                label={t.available}
                availability="AVAILABLE"
              />
              <Stat
                value={onProject.length}
                label={t.onProject}
                availability="ON_PROJECT"
              />
              <Stat
                value={absent.length}
                label={t.absent}
                availability="SICK"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ablaufwarnungen */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t.expiringTitle}
          </CardTitle>
          <AlertTriangle
            className={`h-4 w-4 ${
              expiringCount ? 'text-amber-500' : 'text-muted-foreground'
            }`}
          />
        </CardHeader>
        <CardContent>
          {expiringCount === null ? (
            <p className="text-sm text-muted-foreground">
              {texts.common.loading}
            </p>
          ) : expiringCount > 0 ? (
            <Link href="/workers" className="block">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {expiringCount}
              </p>
              <p className="mt-1 text-sm text-muted-foreground hover:text-foreground">
                {t.expiringWarning(expiringCount)}
              </p>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{t.expiringNone}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  value,
  label,
  availability,
}: {
  value: number;
  label: string;
  availability: WorkerAvailability;
}): React.ReactNode {
  return (
    <div className="space-y-1">
      <div className="text-2xl font-bold">{value}</div>
      <AvailabilityBadge availability={availability} />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
