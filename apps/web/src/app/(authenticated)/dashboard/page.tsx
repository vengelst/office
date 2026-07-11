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
  CheckSquare,
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
import { todosApi, type TodoDashboardData } from '@/lib/todos';
import { Badge } from '@/components/ui/badge';
import { texts } from '@/lib/texts';

interface DashboardStats {
  customers: number;
  projects: number;
  workers: number;
  hoursThisWeek: number;
}

const cards = [
  { key: 'customers', label: texts.dashboard.cards.customers, icon: Users, href: '/customers' },
  { key: 'projects', label: texts.dashboard.cards.projects, icon: FolderKanban, href: '/projects' },
  { key: 'workers', label: texts.dashboard.cards.workers, icon: HardHat, href: '/workers' },
  { key: 'hours', label: texts.dashboard.cards.hours, icon: Clock, href: '/time-clock' },
] as const;

type CardKey = (typeof cards)[number]['key'];

/** Formatiert den Statistik-Wert je nach Karten-Typ für die Anzeige. */
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

/**
 * Dashboard-Seite mit Überblick über die wichtigsten Kennzahlen.
 * Zeigt Kunden-, Projekt-, Mitarbeiter-Anzahl, Wochenstunden,
 * eingestempelte Monteure, Rechnungsstatus (offen/überfällig),
 * Mitarbeiter-Verfügbarkeit mit Ablaufwarnungen und Fuhrpark-Status.
 */
export default function DashboardPage(): React.ReactNode {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workers, setWorkers] = useState<WorkerListItem[] | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);
  const [clockedInCount, setClockedInCount] = useState<number | null>(null);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [vehicles, setVehicles] = useState<VehicleListItem[] | null>(null);
  const [vehiclesExpiring, setVehiclesExpiring] = useState<number | null>(null);
  const [todoDashboard, setTodoDashboard] = useState<TodoDashboardData | null>(null);

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
    todosApi
      .getDashboard()
      .then(setTodoDashboard)
      .catch(() => setTodoDashboard(null));
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
            <Link key={card.key} href={card.href} className="block">
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
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
            </Link>
          );
        })}
      </div>

      <TodosWidget data={todoDashboard} />

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

/**
 * Dashboard-Widget für den Fuhrpark.
 * Zeigt Gesamtanzahl, zugewiesene Fahrzeuge und Ablaufwarnungen (TÜV, Versicherung etc.).
 */
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

/** Dashboard-Karte für aktuell eingestempelte Monteure mit Link zur Live-Ansicht. */
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

/**
 * Dashboard-Widget für Rechnungen.
 * Zeigt offene Ausgangsrechnungen (Betrag + Anzahl) und
 * überfällige Rechnungen als Warnkarte mit Link zur Rechnungsliste.
 */
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

const TODO_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function TodosWidget({
  data,
}: {
  data: TodoDashboardData | null;
}): React.ReactNode {
  const dt = texts.todos.dashboard;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {dt.title}
        </CardTitle>
        <Link href="/todos" className="text-xs text-primary hover:underline">
          {dt.showAll}
        </Link>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <p className="text-sm text-muted-foreground">
            {texts.common.loading}
          </p>
        ) : data.openCount === 0 && data.overdueCount === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckSquare className="h-4 w-4 text-green-500" />
            {dt.noTasks}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{data.openCount}</div>
                <p className="text-xs text-muted-foreground">{dt.open}</p>
              </div>
              <div className="space-y-1">
                <div
                  className={`text-2xl font-bold ${
                    data.overdueCount > 0
                      ? 'text-red-600 dark:text-red-400'
                      : ''
                  }`}
                >
                  {data.overdueCount}
                </div>
                <p className="text-xs text-muted-foreground">{dt.overdue}</p>
              </div>
            </div>

            {data.upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {dt.upcoming}
                </p>
                {data.upcoming.map((todo) => (
                  <Link
                    key={todo.id}
                    href="/todos"
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="truncate font-medium">{todo.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`border-0 text-[10px] ${TODO_PRIORITY_COLORS[todo.priority]}`}
                      >
                        {texts.todos.priority[todo.priority]}
                      </Badge>
                      {todo.dueDate && (
                        <span
                          className={`text-xs ${
                            new Date(todo.dueDate) < new Date()
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {new Date(todo.dueDate).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ABSENT: WorkerAvailability[] = ['SICK', 'VACATION', 'UNAVAILABLE'];

/**
 * Dashboard-Widget für Mitarbeiter-Verfügbarkeit.
 * Zeigt Verteilung nach Status (Verfügbar/Auf Projekt/Abwesend)
 * und Anzahl ablaufender Dokumente als Warnung.
 */
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

/** Einzelne Statistik-Zelle im Mitarbeiter-Widget mit Zahl, Badge und Label. */
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
