'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmptyState } from '@/components/customers/empty-state';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { useToast } from '@/components/ui/use-toast';
import {
  projectsApi,
  type ProjectNote,
  type ProjectStatus,
  type ProjectStatusHistory,
} from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const fmtDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function NotesHistoryTab({
  projectId,
  statusHistory,
}: {
  projectId: string;
  statusHistory: ProjectStatusHistory[];
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    projectsApi
      .listNotes(projectId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = (): void => {
    if (!body.trim()) return;
    setSaving(true);
    projectsApi
      .createNote(projectId, { body: body.trim() })
      .then(() => {
        toast({ description: t.toast.noteAdded });
        setBody('');
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

  const confirmDelete = (): void => {
    if (!deleteId) return;
    projectsApi
      .removeNote(projectId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const sortedHistory = [...statusHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Notizen */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.tabs.notizenVerlauf}
        </h3>
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={t.fields.noteBody}
          />
          <Button onClick={add} disabled={saving || !body.trim()} className="min-h-[44px]">
            {saving ? t.actions.saving : t.actions.addNote}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <EmptyState message={t.empties.notes} />
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <Card key={n.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-destructive"
                      onClick={() => setDeleteId(n.id)}
                      aria-label={t.actions.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(n.createdAt)}
                    {n.createdBy && <> · {n.createdBy.displayName}</>}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Status-Verlauf */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.statusHistory}
        </h3>
        {sortedHistory.length === 0 ? (
          <EmptyState message={t.empties.statusHistory} />
        ) : (
          <ol className="relative space-y-4 border-l pl-6">
            {sortedHistory.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  {h.fromStatus && (
                    <>
                      <ProjectStatusBadge status={h.fromStatus as ProjectStatus} />
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <ProjectStatusBadge status={h.toStatus as ProjectStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDateTime(h.changedAt)}
                  {h.changedBy && <> · {h.changedBy.displayName}</>}
                </p>
                {h.comment && <p className="mt-1 text-sm">{h.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.actions.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
