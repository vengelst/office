'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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
import { Field } from '@/components/customers/customer-form';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { teamsApi, workerFullName, type TeamListItem } from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function TeamsPage(): React.ReactNode {
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.teams;
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    teamsApi
      .list()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (): void => {
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  const create = (): void => {
    if (!name.trim()) return;
    setSaving(true);
    teamsApi
      .create({ name, description: description.trim() || undefined })
      .then((created) => {
        toast({ description: t.toast.created });
        router.push(`/teams/${created.id}`);
      })
      .catch((err) => {
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        });
        setSaving(false);
      });
  };

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle}>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.newTeam}
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          message={t.empty}
          actionLabel={t.emptyAction}
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`} className="block">
              <Card className="h-full active:bg-muted/50">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{team.name}</p>
                    <Badge variant="secondary" className="shrink-0">
                      <Users className="mr-1 h-3 w-3" />
                      {team._count.members}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.leader}:{' '}
                    {team.leader ? workerFullName(team.leader) : t.noLeader}
                  </p>
                  {team.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {team.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.fields.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={t.fields.description}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={create}
              disabled={saving || !name.trim()}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
