'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/customers/empty-state';
import { customerPlApi, type CustomerPlProject } from '@/lib/work-items';
import { texts } from '@/lib/texts';

/**
 * Startseite des Kunden-PLs: alle item-basierten Projekte mit aktiver
 * Kunden-PL-Zuordnung (`GET /pl/projects`). Andere Projekte liefert die API
 * gar nicht erst aus.
 */
export default function CustomerPlProjectsPage(): React.ReactNode {
  const router = useRouter();
  const t = texts.customerPl.projects;

  const [projects, setProjects] = useState<CustomerPlProject[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    customerPlApi
      .projects()
      .then(setProjects)
      .catch(() => setProjects(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (id: string): void => router.push(`/pl/projects/${id}`);

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          {t.reload}
        </Button>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : projects === null ? (
        <EmptyState message={t.error} actionLabel={t.reload} onAction={load} />
      ) : projects.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.projectNumber}</TableHead>
                  <TableHead>{t.columns.title}</TableHead>
                  <TableHead>{t.columns.customer}</TableHead>
                  <TableHead className="text-right">{t.columns.items}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => open(project.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && open(project.id)}
                  >
                    <TableCell className="font-mono text-sm">
                      {project.projectNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {project.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.customer?.companyName ?? '–'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {project._count.workItems}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil: Karten mit Touch-Ziel ≥44px */}
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer"
                onClick={() => open(project.id)}
              >
                <CardContent className="space-y-1 p-4">
                  <p className="font-mono text-xs text-muted-foreground">
                    {project.projectNumber}
                  </p>
                  <p className="font-medium">{project.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.customer?.companyName ?? '–'} ·{' '}
                    {project._count.workItems} {t.columns.items}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
