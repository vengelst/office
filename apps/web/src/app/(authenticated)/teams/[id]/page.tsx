'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { useToast } from '@/components/ui/use-toast';
import {
  teamsApi,
  workerFullName,
  workersApi,
  type TeamDetail,
  type WorkerListItem,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const NO_LEADER = '__none__';

export default function TeamDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.teams;

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Info-Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState<string>(NO_LEADER);

  // Mitglied-hinzufügen-Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [allWorkers, setAllWorkers] = useState<WorkerListItem[]>([]);
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(() => {
    teamsApi
      .get(id)
      .then((tm) => {
        setTeam(tm);
        setName(tm.name);
        setDescription(tm.description ?? '');
        setLeaderId(tm.leaderId ?? NO_LEADER);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!addOpen) return;
    workersApi
      .list({ limit: 100 })
      .then((r) => setAllWorkers(r.data))
      .catch(() => setAllWorkers([]));
  }, [addOpen]);

  const saveInfo = (): void => {
    if (!name.trim()) return;
    setSaving(true);
    teamsApi
      .update(id, {
        name,
        description: description.trim() || undefined,
        leaderId: leaderId === NO_LEADER ? undefined : leaderId,
      })
      .then(() => {
        toast({ description: t.toast.updated });
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const addMember = (): void => {
    if (!newWorkerId) return;
    setAddSaving(true);
    teamsApi
      .addMember(id, {
        workerId: newWorkerId,
        role: newRole.trim() || undefined,
      })
      .then(() => {
        toast({ description: t.toast.memberAdded });
        setAddOpen(false);
        setNewWorkerId('');
        setNewRole('');
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setAddSaving(false));
  };

  const confirmRemoveMember = (): void => {
    if (!removeMemberId) return;
    teamsApi
      .removeMember(id, removeMemberId)
      .then(() => {
        toast({ description: t.toast.memberRemoved });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setRemoveMemberId(null));
  };

  const handleDelete = (): void => {
    teamsApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/teams');
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/teams">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const existingIds = new Set(team.members.map((m) => m.workerId));
  const selectableWorkers = allWorkers.filter((w) => !existingIds.has(w.id));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teams" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{team.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <Button
          variant="outline"
          className="min-h-[44px] text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          {t.actions.delete}
        </Button>
      </div>

      {/* Team-Info */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t.sections.info}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t.fields.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={t.fields.leader}>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEADER}>{t.noLeader}</SelectItem>
                  {team.members.map((m) => (
                    <SelectItem key={m.workerId} value={m.workerId}>
                      {workerFullName(m.worker)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.fields.description} className="md:col-span-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <Button
            onClick={saveInfo}
            disabled={saving || !name.trim()}
            className="min-h-[44px]"
          >
            {saving ? t.actions.saving : t.actions.save}
          </Button>
        </CardContent>
      </Card>

      {/* Mitglieder */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t.sections.members} ({team.members.length})
          </h3>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            {t.actions.addMember}
          </Button>
        </div>

        {team.members.length === 0 ? (
          <EmptyState message={t.empties.members} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.members.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Link href={`/workers/${m.workerId}`}>
                    <WorkerAvatar
                      workerId={m.workerId}
                      hasPhoto={!!m.worker.photoPath}
                      name={workerFullName(m.worker)}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/workers/${m.workerId}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {workerFullName(m.worker)}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.role && <Badge variant="outline">{m.role}</Badge>}
                      {team.leaderId === m.workerId && (
                        <Badge variant="secondary">{t.leader}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.joinedAt}: {formatDate(m.joinedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    onClick={() => setRemoveMemberId(m.id)}
                    aria-label={t.actions.removeMember}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Mitglied hinzufügen */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.actions.addMember}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.worker} required>
              <Select value={newWorkerId} onValueChange={setNewWorkerId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  {selectableWorkers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workerFullName(w)} ({w.workerNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.fields.role}>
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={addMember}
              disabled={addSaving || !newWorkerId}
              className="min-h-[44px]"
            >
              {addSaving ? t.actions.saving : t.actions.addMember}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeMemberId !== null}
        onOpenChange={(o) => !o && setRemoveMemberId(null)}
        title={t.actions.removeMember}
        confirmLabel={t.actions.removeMember}
        onConfirm={confirmRemoveMember}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={handleDelete}
      />
    </div>
  );
}
