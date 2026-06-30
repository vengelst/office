'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  teamsApi,
  type TeamListItem,
  type WorkerAssignment,
  type WorkerDetail,
} from '@/lib/workers';
import { projectsApi } from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

export function WorkerProjectsTab({
  worker,
  onChange,
}: {
  worker: WorkerDetail;
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.workers;
  const s = t.sections;

  const current = worker.currentAssignment;
  const history = worker.assignments.filter((a) => !a.active);

  const [endOpen, setEndOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [teamId, setTeamId] = useState('');
  const [teamRole, setTeamRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamDialogOpen) return;
    teamsApi
      .list()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, [teamDialogOpen]);

  const endAssignment = (): void => {
    if (!current) return;
    projectsApi
      .updateAssignment(current.projectId, current.id, { active: false })
      .then(() => {
        toast({ description: t.toast.assignmentEnded });
        onChange();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setEndOpen(false));
  };

  const addToTeam = (): void => {
    if (!teamId) return;
    setSaving(true);
    teamsApi
      .addMember(teamId, {
        workerId: worker.id,
        role: teamRole.trim() || undefined,
      })
      .then(() => {
        toast({ description: texts.teams.toast.memberAdded });
        setTeamDialogOpen(false);
        setTeamId('');
        setTeamRole('');
        onChange();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-8">
      {/* Aktuelle Projektzuweisung */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.currentAssignment}
        </h3>
        {current ? (
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <Link
                  href={`/projects/${current.projectId}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {current.project.title}
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  {current.project.projectNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {current.roleName && <>{current.roleName} · </>}
                  {t.fields.since} {formatDate(current.startDate)}
                </p>
              </div>
              <Button
                variant="outline"
                className="min-h-[44px] text-destructive"
                onClick={() => setEndOpen(true)}
              >
                {t.actions.endAssignment}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyState message={t.empties.currentAssignment} />
        )}
      </section>

      {/* Projekt-Historie */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.projectHistory}
        </h3>
        {history.length === 0 ? (
          <EmptyState message={t.empties.projectHistory} />
        ) : (
          <div className="space-y-2">
            {history.map((a) => (
              <HistoryRow key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </section>

      {/* Teams */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.teams}
          </h3>
          <Button
            size="sm"
            onClick={() => setTeamDialogOpen(true)}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            {t.actions.addToTeam}
          </Button>
        </div>
        {worker.teamMemberships.length === 0 ? (
          <EmptyState message={t.empties.teams} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {worker.teamMemberships.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Link
                    href={`/teams/${m.teamId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {m.team.name}
                  </Link>
                  {m.role && <Badge variant="outline">{m.role}</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Zuweisung beenden */}
      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title={t.actions.endAssignment}
        description={current?.project.title}
        confirmLabel={t.actions.endAssignment}
        onConfirm={endAssignment}
      />

      {/* Zu Team hinzufügen */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.actions.addToTeam}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.team} required>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.fields.role}>
              <Input
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTeamDialogOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={addToTeam}
              disabled={saving || !teamId}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryRow({
  assignment,
}: {
  assignment: WorkerAssignment;
}): ReactNode {
  const period = [
    formatDate(assignment.startDate),
    assignment.endDate ? formatDate(assignment.endDate) : '…',
  ]
    .filter(Boolean)
    .join(' – ');
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${assignment.projectId}`}
            className="font-medium text-primary hover:underline"
          >
            {assignment.project.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {assignment.roleName && <>{assignment.roleName} · </>}
            {period}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
