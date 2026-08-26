'use client';

import { MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatDate,
  formatMinutes,
  formatTime,
  type TimesheetDay,
  type TimesheetDetail,
} from '@/lib/timesheets';
import { texts } from '@/lib/texts';
import { weekdayLabel } from './utils';

export function WeekTab({
  sheet,
  editable,
  onEdit,
}: {
  sheet: TimesheetDetail;
  editable: boolean;
  onEdit: (d: TimesheetDay) => void;
}): React.ReactNode {
  const t = texts.timesheets.week;

  if (sheet.days.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t.noData}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.day}</TableHead>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.start}</TableHead>
            <TableHead>{t.end}</TableHead>
            <TableHead className="text-right">{t.gross}</TableHead>
            <TableHead className="text-right">{t.break}</TableHead>
            <TableHead className="text-right">{t.net}</TableHead>
            <TableHead>{t.activities}</TableHead>
            <TableHead>{t.comment}</TableHead>
            {editable && <TableHead className="w-px" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheet.days.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">
                {weekdayLabel(d.workDate)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  {formatDate(d.workDate)}
                  {d.clockInLatitude != null && d.clockInLongitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${d.clockInLatitude},${d.clockInLongitude}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t.gps}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </a>
                  )}
                </span>
              </TableCell>
              <TableCell className="font-mono">
                {formatTime(d.firstClockInAt)}
              </TableCell>
              <TableCell className="font-mono">
                {formatTime(d.lastClockOutAt)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMinutes(d.grossMinutes)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMinutes(d.breakMinutes)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {formatMinutes(d.netMinutes)}
              </TableCell>
              <TableCell className="max-w-[12rem] text-xs text-muted-foreground">
                {(d.activities ?? []).length === 0
                  ? '—'
                  : (d.activities ?? [])
                      .map(
                        (a) =>
                          `${a.activityType.name} ${formatMinutes(a.minutes)}`,
                      )
                      .join(' · ')}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                {d.summaryComment ?? ''}
              </TableCell>
              {editable && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={4}>{t.total}</TableCell>
            <TableCell className="text-right font-mono">
              {formatMinutes(sheet.totalMinutesGross)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatMinutes(sheet.totalBreakMinutes)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatMinutes(sheet.totalMinutesNet)}
            </TableCell>
            <TableCell />
            {editable && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}
