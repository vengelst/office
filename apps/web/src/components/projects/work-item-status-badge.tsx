import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  WORK_ITEM_STATUS_LABELS,
  type WorkItemStatus,
} from '@/lib/work-items';

/** Statusfarben: Offen=grau, In Arbeit=blau, Kontrolle=amber, Nacharbeit=rot, Geprüft=grün. */
const STYLES: Record<WorkItemStatus, string> = {
  OPEN: 'bg-muted text-foreground',
  IN_PROGRESS: 'bg-blue-600 text-white hover:bg-blue-600',
  REVIEW: 'bg-amber-500 text-black hover:bg-amber-500',
  REWORK: 'bg-red-600 text-white hover:bg-red-600',
  APPROVED: 'bg-green-600 text-white hover:bg-green-600',
};

export function WorkItemStatusBadge({
  status,
  className,
}: {
  status: WorkItemStatus;
  className?: string;
}): React.ReactNode {
  return (
    <Badge className={cn('border-transparent', STYLES[status], className)}>
      {WORK_ITEM_STATUS_LABELS[status]}
    </Badge>
  );
}
