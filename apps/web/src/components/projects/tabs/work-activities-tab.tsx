'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  projectsApi,
  type ProjectWorkActivity,
} from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

/**
 * Projekt-Tab: Arbeitstätigkeiten (Checkbox-Labels) + Freitext-Flag.
 */
export function WorkActivitiesTab({
  projectId,
  workNotesEnabled,
  activities,
  onChange,
}: {
  projectId: string;
  workNotesEnabled: boolean;
  activities: ProjectWorkActivity[];
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects.workActivities;
  const [notesEnabled, setNotesEnabled] = useState(workNotesEnabled);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWorkActivity | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);

  const openCreate = (): void => {
    setEditing(null);
    setLabel('');
    setDialogOpen(true);
  };

  const openEdit = (a: ProjectWorkActivity): void => {
    setEditing(a);
    setLabel(a.label);
    setDialogOpen(true);
  };

  const save = (): void => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    const req = editing
      ? projectsApi.updateWorkActivity(projectId, editing.id, { label: trimmed })
      : projectsApi.createWorkActivity(projectId, { label: trimmed });
    req
      .then(() => {
        toast({
          description: editing ? t.toastUpdated : t.toastAdded,
        });
        setDialogOpen(false);
        onChange();
      })
      .catch((err) =>
        toast({
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const toggleActive = (a: ProjectWorkActivity): void => {
    projectsApi
      .updateWorkActivity(projectId, a.id, { active: !a.active })
      .then(() => onChange())
      .catch((err) =>
        toast({
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      );
  };

  const move = (a: ProjectWorkActivity, dir: -1 | 1): void => {
    const sorted = [...activities].sort((x, y) => x.sortOrder - y.sortOrder);
    const idx = sorted.findIndex((x) => x.id === a.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    Promise.all([
      projectsApi.updateWorkActivity(projectId, a.id, {
        sortOrder: swap.sortOrder,
      }),
      projectsApi.updateWorkActivity(projectId, swap.id, {
        sortOrder: a.sortOrder,
      }),
    ])
      .then(() => onChange())
      .catch((err) =>
        toast({
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      );
  };

  const onFlagChange = (checked: boolean): void => {
    setNotesEnabled(checked);
    setFlagBusy(true);
    projectsApi
      .update(projectId, { workNotesEnabled: checked })
      .then(() => {
        toast({ description: t.toastFlag });
        onChange();
      })
      .catch((err) => {
        setNotesEnabled(!checked);
        toast({
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        });
      })
      .finally(() => setFlagBusy(false));
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    projectsApi
      .removeWorkActivity(projectId, deleteId)
      .then(() => {
        toast({ description: t.toastDeleted });
        setDeleteId(null);
        onChange();
      })
      .catch((err) =>
        toast({
          description:
            err instanceof ApiError ? err.message : texts.projects.toast.error,
        }),
      );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.flagTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3">
            <input
              id="work-notes-flag"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={notesEnabled}
              disabled={flagBusy}
              onChange={(e) => onFlagChange(e.target.checked)}
            />
            <div>
              <Label htmlFor="work-notes-flag">{t.flagLabel}</Label>
              <p className="mt-1 text-sm text-muted-foreground">{t.flagHint}</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">{t.listTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.listHint}</p>
        </div>
        <Button type="button" onClick={openCreate} className="min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />
          {t.add}
        </Button>
      </div>

      {activities.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <ul className="divide-y rounded-md border">
          {activities.map((a, i) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 px-3 py-3"
            >
              <span className="min-w-0 flex-1 text-sm font-medium">
                {a.label}
              </span>
              <Badge variant={a.active ? 'default' : 'secondary'}>
                {a.active ? t.active : t.inactive}
              </Badge>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={i === 0}
                  onClick={() => move(a, -1)}
                  aria-label={t.moveUp}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={i === activities.length - 1}
                  onClick={() => move(a, 1)}
                  aria-label={t.moveDown}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleActive(a)}
                  aria-label={a.active ? t.deactivate : t.activate}
                >
                  {a.active ? '○' : '●'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(a)}
                  aria-label={t.edit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(a.id)}
                  aria-label={t.delete}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.editTitle : t.addTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wa-label">{t.labelField}</Label>
            <Input
              id="wa-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="min-h-[44px]"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {texts.projects.actions.cancel}
            </Button>
            <Button
              type="button"
              disabled={!label.trim() || saving}
              onClick={save}
            >
              {texts.projects.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
