import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClockStatus, WorkerMeAssignment } from '@/lib/timesheets';

interface CurrentProjectSectionProps {
  activeProject: ClockStatus['project'] | null | undefined;
  current: WorkerMeAssignment[];
  future: WorkerMeAssignment[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  currentProjectLabel: string;
  noProjectLabel: string;
  upcomingProjectsLabel: string;
}

export function CurrentProjectSection({
  activeProject,
  current,
  future,
  selectedProjectId,
  onProjectChange,
  currentProjectLabel,
  noProjectLabel,
  upcomingProjectsLabel,
}: CurrentProjectSectionProps) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {currentProjectLabel}
      </p>
      {activeProject ? (
        <div className="mt-1">
          <p className="text-lg font-semibold">{activeProject.title}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {activeProject.projectNumber}
          </p>
        </div>
      ) : current.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{noProjectLabel}</p>
      ) : current.length === 1 ? (
        <div className="mt-1">
          <p className="text-lg font-semibold">{current[0].project.title}</p>
          <p className="text-xs text-muted-foreground">
            {current[0].project.customer?.companyName ?? ''}
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <Select value={selectedProjectId} onValueChange={onProjectChange}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {current.map((a) => (
                <SelectItem key={a.id} value={a.project.id}>
                  {a.project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {future.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {upcomingProjectsLabel}
          </p>
          <ul className="mt-2 space-y-1">
            {future.map((a) => (
              <li
                key={a.id}
                className="flex justify-between text-sm text-muted-foreground"
              >
                <span className="truncate">{a.project.title}</span>
                <span className="ml-2 shrink-0 text-xs">
                  {new Date(a.startDate).toLocaleDateString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
