'use client';

import { type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/customers/empty-state';
import { formatDate } from '@/lib/format';
import type { WorkerDetail, WorkerEquipmentIssue } from '@/lib/workers';
import { texts } from '@/lib/texts';

const CATEGORY_LABELS: Record<string, string> = {
  TOOL: 'Werkzeug',
  PSA: 'PSA',
  ELECTRONICS: 'Messgerät',
  OTHER: 'Sonstiges',
};

function IssueStatus({ issue }: { issue: WorkerEquipmentIssue }): ReactNode {
  return issue.returnedAt ? (
    <Badge variant="secondary">{texts.workers.fields.returnedAt}</Badge>
  ) : (
    <Badge className="border-transparent bg-amber-500 text-black hover:bg-amber-500">
      {texts.workers.fields.issuedAt}
    </Badge>
  );
}

export function WorkerEquipmentTab({
  worker,
}: {
  worker: WorkerDetail;
}): ReactNode {
  const t = texts.workers;
  const f = t.fields;
  const issues = worker.equipmentIssues ?? [];

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
        {t.equipmentHint}
      </p>

      {issues.length === 0 ? (
        <EmptyState message={t.empties.equipment} />
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{f.equipmentName}</TableHead>
                  <TableHead>{f.category}</TableHead>
                  <TableHead>{f.issuedAt}</TableHead>
                  <TableHead>{f.returnedAt}</TableHead>
                  <TableHead>{f.condition}</TableHead>
                  <TableHead>{f.availability}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.equipmentItem?.name ?? '–'}
                    </TableCell>
                    <TableCell>
                      {e.equipmentItem
                        ? (CATEGORY_LABELS[e.equipmentItem.category] ??
                          e.equipmentItem.category)
                        : '–'}
                    </TableCell>
                    <TableCell>{formatDate(e.issuedAt) || '–'}</TableCell>
                    <TableCell>
                      {e.returnedAt ? formatDate(e.returnedAt) : '–'}
                    </TableCell>
                    <TableCell>{e.conditionOut ?? '–'}</TableCell>
                    <TableCell>
                      <IssueStatus issue={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: Karten */}
          <div className="space-y-3 md:hidden">
            {issues.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {e.equipmentItem?.name ?? '–'}
                      </p>
                      {e.equipmentItem && (
                        <p className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[e.equipmentItem.category] ??
                            e.equipmentItem.category}
                        </p>
                      )}
                    </div>
                    <IssueStatus issue={e} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.issuedAt}: {formatDate(e.issuedAt) || '–'}
                    {e.returnedAt && (
                      <>
                        {' '}
                        · {f.returnedAt}: {formatDate(e.returnedAt)}
                      </>
                    )}
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
