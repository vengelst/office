'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DocumentsTab } from '@/components/customers/tabs/documents-tab';
import { ProjectForm } from '@/components/projects/project-form';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { SitesTab } from '@/components/projects/tabs/sites-tab';
import { AssignmentsTab } from '@/components/projects/tabs/assignments-tab';
import { EquipmentTab } from '@/components/projects/tabs/equipment-tab';
import { EmailRecipientsTab } from '@/components/projects/tabs/email-recipients-tab';
import { NotesHistoryTab } from '@/components/projects/tabs/notes-history-tab';
import { useToast } from '@/components/ui/use-toast';
import {
  projectsApi,
  type ProjectDetail,
  type ProjectStatus,
} from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const STATUSES: ProjectStatus[] = [
  'DRAFT',
  'PLANNED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELED',
];

export default function ProjectDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.projects;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stammdaten');

  // Status ändern
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ProjectStatus>('DRAFT');
  const [statusComment, setStatusComment] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(() => {
    projectsApi
      .get(id)
      .then((p) => {
        setProject(p);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = (payload: Record<string, unknown>): void => {
    setSaving(true);
    projectsApi
      .update(id, payload)
      .then((p) => {
        setProject(p);
        toast({ description: t.toast.updated });
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const handleDelete = (): void => {
    projectsApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/projects');
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const openStatus = (): void => {
    if (project) setNewStatus(project.status);
    setStatusComment('');
    setStatusOpen(true);
  };

  const submitStatus = (): void => {
    setStatusSaving(true);
    projectsApi
      .changeStatus(id, {
        status: newStatus,
        comment: statusComment || undefined,
      })
      .then((p) => {
        setProject(p);
        toast({ description: t.toast.statusChanged });
        setStatusOpen(false);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setStatusSaving(false));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/projects">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{project.title}</span>
      </nav>

      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.title}
            </h1>
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {project.projectNumber} · {project.customer.companyName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={openStatus}>
            <RefreshCw className="h-4 w-4" />
            {t.actions.changeStatus}
          </Button>
          <Button
            variant="outline"
            className="min-h-[44px] text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t.actions.delete}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="stammdaten" className="min-h-[44px]">
            {t.tabs.stammdaten}
          </TabsTrigger>
          <TabsTrigger value="standorte" className="min-h-[44px]">
            {t.tabs.standorte}
          </TabsTrigger>
          <TabsTrigger value="monteure" className="min-h-[44px]">
            {t.tabs.monteure}
          </TabsTrigger>
          <TabsTrigger value="equipment" className="min-h-[44px]">
            {t.tabs.equipment}
          </TabsTrigger>
          <TabsTrigger value="dokumente" className="min-h-[44px]">
            {t.tabs.dokumente}
          </TabsTrigger>
          <TabsTrigger value="emailVerteiler" className="min-h-[44px]">
            {t.tabs.emailVerteiler}
          </TabsTrigger>
          <TabsTrigger value="notizenVerlauf" className="min-h-[44px]">
            {t.tabs.notizenVerlauf}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten">
          <Card>
            <CardContent className="pt-6">
              <ProjectForm
                project={project}
                submitting={saving}
                onSubmit={handleSave}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standorte">
          <Card>
            <CardContent className="pt-6">
              <SitesTab project={project} onChange={load} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monteure">
          <AssignmentsTab
            projectId={id}
            assignments={project.assignments}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentTab
            projectId={id}
            equipment={project.equipment}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="dokumente">
          <DocumentsTab entityId={id} entityType="PROJECT" />
        </TabsContent>

        <TabsContent value="emailVerteiler">
          <EmailRecipientsTab
            projectId={id}
            recipients={project.emailRecipients}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="notizenVerlauf">
          <NotesHistoryTab
            projectId={id}
            statusHistory={project.statusHistory}
          />
        </TabsContent>
      </Tabs>

      {/* Status ändern */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.changeStatus.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t.changeStatus.newStatus}>
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as ProjectStatus)}
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {t.status[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.changeStatus.comment}>
              <Textarea
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusOpen(false)}
              className="min-h-[44px]"
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={submitStatus}
              disabled={statusSaving}
              className="min-h-[44px]"
            >
              {statusSaving ? t.actions.saving : t.changeStatus.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
