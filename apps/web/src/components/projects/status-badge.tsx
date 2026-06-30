import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import type { ProjectStatus } from '@/lib/projects';

/** Statusfarben: Entwurf=grau, Geplant=blau, Aktiv=grün, Pausiert=amber, Abgeschlossen=slate, Abgebrochen=rot. */
const STYLES: Record<ProjectStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  PLANNED: 'bg-blue-600 text-white hover:bg-blue-600',
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-amber-500 text-black hover:bg-amber-500',
  COMPLETED: 'bg-slate-600 text-white hover:bg-slate-600',
  CANCELED: 'bg-red-600 text-white hover:bg-red-600',
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}): React.ReactNode {
  return (
    <Badge className={cn('border-transparent', STYLES[status], className)}>
      {texts.projects.status[status]}
    </Badge>
  );
}
