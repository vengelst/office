'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
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
import { equipmentApi } from '@/lib/equipment';
import type { WorkerDetail, WorkerEquipmentIssue } from '@/lib/workers';
import { texts } from '@/lib/texts';

const CATEGORY_LABELS: Record<string, string> = {
  TOOL: 'Werkzeug',
  PSA: 'PSA',
  ELECTRONICS: 'Messgerät',
  OTHER: 'Sonstiges',
};

interface ManagedEquipment {
  id: string;
  assignedAt: string;
  equipment: {
    id: string;
    name: string;
    category: string | null;
    inventoryNumber: string | null;
    imageKey: string | null;
  };
}

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
  const et = texts.equipment;
  const f = t.fields;
  const issues = worker.equipmentIssues ?? [];
  const [managed, setManaged] = useState<ManagedEquipment[]>([]);

  useEffect(() => {
    equipmentApi
      .getWorkerEquipment(worker.id)
      .then(setManaged)
      .catch(() => setManaged([]));
  }, [worker.id]);

  return (
    <div className="space-y-6">
      {/* Neue Geräte-Zuweisungen aus dem Equipment-Modul */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{et.workerSection}</h3>
        {managed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {et.workerSectionEmpty}
          </p>
        ) : (
          <>
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{et.fields.name}</TableHead>
                    <TableHead>{et.fields.category}</TableHead>
                    <TableHead>{et.fields.inventoryNumber}</TableHead>
                    <TableHead>{et.history.assignedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managed.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/equipment/${m.equipment.id}`}
                          className="hover:underline"
                        >
                          {m.equipment.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {m.equipment.category ? (
                          <Badge variant="outline">{m.equipment.category}</Badge>
                        ) : (
                          '–'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.equipment.inventoryNumber ?? '–'}
                      </TableCell>
                      <TableCell>
                        {formatDate(m.assignedAt) || '–'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <div className="space-y-3 md:hidden">
              {managed.map((m) => (
                <Link
                  key={m.id}
                  href={`/equipment/${m.equipment.id}`}
                  className="block"
                >
                  <Card className="active:bg-muted/50">
                    <CardContent className="space-y-1 p-4">
                      <p className="font-medium">{m.equipment.name}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {m.equipment.category && (
                          <Badge variant="outline" className="text-xs">
                            {m.equipment.category}
                          </Badge>
                        )}
                        {m.equipment.inventoryNumber && (
                          <span className="font-mono">
                            {m.equipment.inventoryNumber}
                          </span>
                        )}
                        <span>seit {formatDate(m.assignedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Alt-Daten (bisherige WorkerEquipmentIssue) */}
      {issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Frühere Ausgaben (Altdaten)</h3>
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
        </div>
      )}

      {issues.length === 0 && managed.length === 0 && (
        <EmptyState message={t.empties.equipment} />
      )}
    </div>
  );
}
