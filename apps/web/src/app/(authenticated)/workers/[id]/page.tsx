'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkerAvatar } from '@/components/workers/worker-avatar';
import { WorkerTypeBadge } from '@/components/workers/worker-badges';
import { WorkerMasterForm } from '@/components/workers/worker-master-form';
import { WorkerDocumentsTab } from '@/components/workers/worker-documents-tab';
import { WorkerQualificationsTab } from '@/components/workers/worker-qualifications-tab';
import { WorkerContractTab } from '@/components/workers/worker-contract-tab';
import { WorkerEquipmentTab } from '@/components/workers/worker-equipment-tab';
import { WorkerProjectsTab } from '@/components/workers/worker-projects-tab';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  workerFullName,
  workersApi,
  type WorkerAvailability,
  type WorkerDetail,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const AVAILABILITIES: WorkerAvailability[] = [
  'AVAILABLE',
  'ON_PROJECT',
  'SICK',
  'VACATION',
  'UNAVAILABLE',
];

export default function WorkerDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.workers;

  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('master');

  const load = useCallback(() => {
    workersApi
      .get(id)
      .then((w) => {
        setWorker(w);
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
    workersApi
      .update(id, payload)
      .then((w) => {
        setWorker(w);
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

  const handleAvailability = (value: WorkerAvailability): void => {
    workersApi
      .update(id, { availability: value })
      .then((w) => {
        setWorker(w);
        toast({ description: t.toast.availabilityChanged });
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  const handleDelete = (): void => {
    workersApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/workers');
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
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

  if (notFound || !worker) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/workers">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const name = workerFullName(worker);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/workers" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{name}</span>
      </nav>

      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <WorkerAvatar
            workerId={worker.id}
            hasPhoto={!!worker.photoPath}
            name={name}
            size="lg"
            editable
            onUploaded={() => {
              toast({ description: t.toast.photoUploaded });
              load();
            }}
            onError={(message) =>
              toast({ variant: 'destructive', description: message })
            }
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <WorkerTypeBadge type={worker.workerType} />
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {worker.workerNumber}
            </p>
            <div className="pt-1">
              <Select
                value={worker.availability}
                onValueChange={(v) =>
                  handleAvailability(v as WorkerAvailability)
                }
              >
                <SelectTrigger
                  className="h-9 w-48"
                  aria-label={t.actions.changeAvailability}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITIES.map((av) => (
                    <SelectItem key={av} value={av}>
                      {t.availability[av]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px] text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          {t.actions.delete}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="master" className="min-h-[44px]">
            {t.tabs.master}
          </TabsTrigger>
          <TabsTrigger value="documents" className="min-h-[44px]">
            {t.tabs.documents}
          </TabsTrigger>
          <TabsTrigger value="qualifications" className="min-h-[44px]">
            {t.tabs.qualifications}
          </TabsTrigger>
          <TabsTrigger value="contract" className="min-h-[44px]">
            {t.tabs.contract}
          </TabsTrigger>
          <TabsTrigger value="equipment" className="min-h-[44px]">
            {t.tabs.equipment}
          </TabsTrigger>
          <TabsTrigger value="projects" className="min-h-[44px]">
            {t.tabs.projects}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master">
          <Card>
            <CardContent className="pt-6">
              <WorkerMasterForm
                worker={worker}
                submitting={saving}
                onSubmit={handleSave}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <WorkerDocumentsTab worker={worker} onSaved={load} />
        </TabsContent>

        <TabsContent value="qualifications">
          <WorkerQualificationsTab worker={worker} onChange={load} />
        </TabsContent>

        <TabsContent value="contract">
          <WorkerContractTab worker={worker} onSaved={load} />
        </TabsContent>

        <TabsContent value="equipment">
          <WorkerEquipmentTab worker={worker} />
        </TabsContent>

        <TabsContent value="projects">
          <WorkerProjectsTab worker={worker} onChange={load} />
        </TabsContent>
      </Tabs>

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
