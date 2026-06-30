import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import type { WeeklyTimesheetStatus } from '@/lib/timesheets';

const STYLES: Record<WeeklyTimesheetStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  WORKER_SIGNED:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CUSTOMER_SIGNED:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  SUBMITTED:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  REVIEWED:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  APPROVED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  COMPLETED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  LOCKED:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED:
    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function TimesheetStatusBadge({
  status,
}: {
  status: WeeklyTimesheetStatus;
}): React.ReactNode {
  return (
    <Badge variant="outline" className={cn('border-transparent', STYLES[status])}>
      {texts.timesheets.status[status]}
    </Badge>
  );
}
