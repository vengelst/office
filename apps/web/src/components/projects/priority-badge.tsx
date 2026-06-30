import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import type { Priority } from '@/lib/projects';

/** Prioritätsfarben: Niedrig=grau, Mittel=blau, Hoch=amber, Dringend=rot. */
const STYLES: Record<Priority, string> = {
  LOW: 'bg-muted text-foreground',
  MEDIUM: 'bg-blue-600 text-white hover:bg-blue-600',
  HIGH: 'bg-amber-500 text-black hover:bg-amber-500',
  URGENT: 'bg-red-600 text-white hover:bg-red-600',
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}): React.ReactNode {
  return (
    <Badge className={cn('border-transparent', STYLES[priority], className)}>
      {texts.projects.priority[priority]}
    </Badge>
  );
}
