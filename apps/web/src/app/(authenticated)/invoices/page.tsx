'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InvoiceStatusBadge } from '@/components/invoices/status-badge';
import { GenerateDialog } from '@/components/invoices/generate-dialog';
import { formatDate } from '@/lib/format';
import {
  formatCurrency,
  invoicePartyName,
  invoicesApi,
  isOverdue,
  type InvoiceListResponse,
  type InvoiceStatus,
  type InvoiceType,
} from '@/lib/invoices';
import { projectsApi, type ProjectListItem } from '@/lib/projects';
import { subcontractorsApi, type SubcontractorListItem } from '@/lib/workers';
import { texts } from '@/lib/texts';

const LIMIT = 25;
const ALL = '__all__';
const STATUSES: InvoiceStatus[] = [
  'DRAFT',
  'SENT',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
];

function formatPeriod(from: string | null, to: string | null): string {
  if (!from && !to) return '–';
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export default function InvoicesPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.invoices;

  const [invoiceType, setInvoiceType] = useState<InvoiceType>('OUTGOING');
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ALL);
  const [projectId, setProjectId] = useState(ALL);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorListItem[]>(
    [],
  );
  const [genOpen, setGenOpen] = useState(false);

  useEffect(() => {
    projectsApi
      .list({ limit: 100 })
      .then((r) => setProjects(r.data))
      .catch(() => setProjects([]));
    subcontractorsApi
      .list({ limit: 100 })
      .then((r) => setSubcontractors(r.data))
      .catch(() => setSubcontractors([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    invoicesApi
      .list({
        page,
        limit: LIMIT,
        type: invoiceType,
        status: status === ALL ? undefined : status,
        projectId: projectId === ALL ? undefined : projectId,
        periodFrom: periodFrom
          ? new Date(periodFrom).toISOString()
          : undefined,
        periodTo: periodTo ? new Date(periodTo).toISOString() : undefined,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, invoiceType, status, projectId, periodFrom, periodTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [invoiceType, status, projectId, periodFrom, periodTo]);

  const items = data?.data ?? [];
  const isEmpty = !loading && items.length === 0;
  const noFilters =
    status === ALL && projectId === ALL && !periodFrom && !periodTo;

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setGenOpen(true)}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {t.generate}
        </Button>
        <Button
          className="min-h-[44px]"
          onClick={() => router.push('/invoices/new')}
        >
          <Plus className="h-4 w-4" />
          {t.newInvoice}
        </Button>
      </PageHeader>

      <Tabs
        value={invoiceType}
        onValueChange={(v) => setInvoiceType(v as InvoiceType)}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="OUTGOING">{t.tabsType.outgoing}</TabsTrigger>
          <TabsTrigger value="INCOMING">{t.tabsType.incoming}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t.filters.status}: {t.filters.all}
            </SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t.status[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t.filters.project}: {t.filters.all}
            </SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label={t.filters.periodFrom}
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
          className="min-h-[44px]"
        />
        <Input
          type="date"
          aria-label={t.filters.periodTo}
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          className="min-h-[44px]"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {noFilters ? t.empty : t.noResults}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.columns.invoiceNumber}</TableHead>
                <TableHead>{t.columns.party}</TableHead>
                <TableHead>{t.columns.project}</TableHead>
                <TableHead>{t.columns.period}</TableHead>
                <TableHead className="text-right">{t.columns.net}</TableHead>
                <TableHead className="text-right">{t.columns.gross}</TableHead>
                <TableHead>{t.columns.status}</TableHead>
                <TableHead>{t.columns.dueDate}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => {
                const overdue = isOverdue(inv);
                return (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <TableCell className="font-medium">
                      {inv.invoiceNumber}
                      {inv.isPartialInvoice && inv.partialNumber != null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t.partialLabel(
                            inv.partialNumber,
                            inv.partialPercentage,
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{invoicePartyName(inv)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.project?.title ?? '–'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPeriod(inv.periodFrom, inv.periodTo)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(inv.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(inv.total)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell
                      className={
                        overdue
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {inv.dueDate ? formatDate(inv.dueDate) : '–'}
                      {overdue && (
                        <span className="ml-1 text-xs">({t.overdue})</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {data.total} {t.pagination.showing} · {t.pagination.page}{' '}
            {data.page} {t.pagination.of} {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t.pagination.prev}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              {t.pagination.next}
            </Button>
          </div>
        </div>
      )}

      <GenerateDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        defaultType={invoiceType}
        projects={projects}
        subcontractors={subcontractors}
        onGenerated={(id) => router.push(`/invoices/${id}`)}
      />
    </div>
  );
}
