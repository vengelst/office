import Link from 'next/link';
import { ArrowLeftRight, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EquipmentDetail } from '@/lib/equipment';
import { texts } from '@/lib/texts';
import { fmtDate } from './utils';

export function EquipmentAssignmentsTab({
  equipment,
  onAssign,
  onReturn,
}: {
  equipment: EquipmentDetail;
  onAssign: () => void;
  onReturn: () => void;
}): React.ReactNode {
  const t = texts.equipment;

  return (
    <TabsContent value="assignments" className="mt-4 space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            {equipment.currentAssignment ? (
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  {t.history.current}
                </p>
                <p className="mt-1">
                  <Link
                    href={`/workers/${equipment.currentAssignment.worker.id}`}
                    className="font-medium hover:underline"
                  >
                    {equipment.currentAssignment.worker.firstName}{' '}
                    {equipment.currentAssignment.worker.lastName}
                  </Link>
                  <span className="ml-2 text-sm text-muted-foreground">
                    seit {fmtDate(equipment.currentAssignment.assignedAt)}
                  </span>
                </p>
                {equipment.currentAssignment.expectedReturn && (
                  <p className="text-sm text-muted-foreground">
                    {t.history.expected}:{' '}
                    {fmtDate(equipment.currentAssignment.expectedReturn)}
                  </p>
                )}
                {equipment.currentAssignment.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {equipment.currentAssignment.notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aktuell nicht ausgegeben
              </p>
            )}
            <div className="flex gap-2">
              {equipment.currentAssignment ? (
                <Button
                  className="min-h-[44px]"
                  variant="outline"
                  onClick={onReturn}
                >
                  <CornerDownLeft className="mr-1 h-4 w-4" />
                  {t.return.button}
                </Button>
              ) : (
                <Button className="min-h-[44px]" onClick={onAssign}>
                  <ArrowLeftRight className="mr-1 h-4 w-4" />
                  {t.assign.button}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-semibold">{t.history.title}</h3>
          {equipment.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine vergangenen Zuweisungen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.history.worker}</TableHead>
                  <TableHead>{t.history.assignedAt}</TableHead>
                  <TableHead>{t.history.returnedAt}</TableHead>
                  <TableHead>{t.history.condition}</TableHead>
                  <TableHead>{t.history.notes}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.history.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/workers/${a.worker.id}`}
                        className="hover:underline"
                      >
                        {a.worker.firstName} {a.worker.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{fmtDate(a.assignedAt)}</TableCell>
                    <TableCell>{fmtDate(a.returnedAt)}</TableCell>
                    <TableCell>
                      {a.returnCondition
                        ? t.condition[a.returnCondition]
                        : '–'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {a.notes || a.returnNotes || '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
