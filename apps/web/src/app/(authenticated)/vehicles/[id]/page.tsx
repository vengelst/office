'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Power, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VehicleForm } from '@/components/vehicles/vehicle-form';
import { VehicleAssignmentsTab } from '@/components/vehicles/vehicle-assignments-tab';
import { DocumentsTabV2 } from '@/components/documents/documents-tab-v2';
import {
  CategoryBadge,
  VehicleStatusBadge,
} from '@/components/vehicles/vehicle-badges';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  vehiclesApi,
  vehicleTitle,
  type VehicleDetail,
  type VehicleWorker,
} from '@/lib/vehicles';
import { subcontractorsApi, workerFullName } from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function VehicleDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.vehicles;

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [subcontractors, setSubcontractors] = useState<
    { id: string; name: string }[]
  >([]);
  const [workers, setWorkers] = useState<VehicleWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [tab, setTab] = useState('master');

  const load = useCallback(() => {
    vehiclesApi
      .get(id)
      .then((v) => {
        setVehicle(v);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    subcontractorsApi
      .list({ limit: 100 })
      .then((r) =>
        setSubcontractors(r.data.map((s) => ({ id: s.id, name: s.name }))),
      )
      .catch(() => setSubcontractors([]));
    vehiclesApi
      .listWorkers()
      .then(setWorkers)
      .catch(() => setWorkers([]));
  }, []);

  const handleSave = (payload: Record<string, unknown>): void => {
    setSaving(true);
    vehiclesApi
      .update(id, payload)
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

  const handleDeactivate = (): void => {
    vehiclesApi
      .deactivate(id)
      .then(() => {
        toast({ description: t.toast.deactivated });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const handleReactivate = (): void => {
    vehiclesApi
      .reactivate(id)
      .then(() => {
        toast({ description: t.toast.reactivated });
        load();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const handleDelete = (): void => {
    vehiclesApi
      .remove(id)
      .then((result) => {
        if (result.deleted) {
          toast({ description: t.toast.deleted });
          router.push('/vehicles');
        } else {
          toast({ description: t.hardDeleteBlocked });
          load();
        }
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

  if (notFound || !vehicle) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/vehicles">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const assignedName = vehicle.currentAssignment
    ? workerFullName(vehicle.currentAssignment.worker)
    : null;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/vehicles" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono font-medium text-foreground">
          {vehicle.licensePlate}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {vehicle.licensePlate}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {vehicleTitle(vehicle)}
            </span>
            <CategoryBadge category={vehicle.category} />
            <VehicleStatusBadge workerName={assignedName} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {vehicle.active ? (
            <Button
              variant="outline"
              className="min-h-[44px] text-amber-600"
              onClick={() => setDeactivateOpen(true)}
            >
              <PowerOff className="h-4 w-4" />
              {t.actions.deactivate}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-[44px] text-emerald-600"
              onClick={handleReactivate}
            >
              <Power className="h-4 w-4" />
              {t.actions.reactivate}
            </Button>
          )}
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="master" className="min-h-[44px]">
            {t.tabs.master}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="min-h-[44px]">
            {t.tabs.assignments}
          </TabsTrigger>
          <TabsTrigger value="documents" className="min-h-[44px]">
            {t.tabs.documents}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <VehicleForm
                vehicle={vehicle}
                subcontractors={subcontractors}
                submitting={saving}
                onSubmit={handleSave}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <VehicleAssignmentsTab
            vehicle={vehicle}
            workers={workers}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTabV2 entityType="VEHICLE" entityId={id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={t.deactivateTitle}
        description={t.deactivateConfirm}
        confirmLabel={t.actions.deactivate}
        variant="warning"
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.hardDeleteTitle}
        description={t.hardDeleteConfirm}
        confirmLabel={t.actions.delete}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
