/**
 * Seite: equipment / detail (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  equipmentApi,
  type EquipmentDetail,
  type EquipmentWorker,
} from '@/lib/equipment';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';
import { EquipmentDetailLoading } from '@/components/equipment/detail/equipment-detail-loading';
import { EquipmentDetailNotFound } from '@/components/equipment/detail/equipment-detail-not-found';
import { EquipmentDetailHeader } from '@/components/equipment/detail/equipment-detail-header';
import { EquipmentMasterTab } from '@/components/equipment/detail/equipment-master-tab';
import { EquipmentAssignmentsTab } from '@/components/equipment/detail/equipment-assignments-tab';
import { EquipmentAssignDialog } from '@/components/equipment/detail/equipment-assign-dialog';
import { EquipmentReturnDialog } from '@/components/equipment/detail/equipment-return-dialog';
import { EquipmentLightbox } from '@/components/equipment/detail/equipment-lightbox';

/**
 * UI-Komponente `EquipmentDetailPage`.
 */
export default function EquipmentDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.equipment;

  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [workers, setWorkers] = useState<EquipmentWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [tab, setTab] = useState('master');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const load = useCallback(() => {
    equipmentApi
      .get(id)
      .then((e) => {
        setEquipment(e);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    equipmentApi.listWorkers().then(setWorkers).catch(() => setWorkers([]));
  }, []);

  const handleSave = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      name: fd.get('name') as string,
      description: (fd.get('description') as string) || null,
      category: (fd.get('category') as string) || null,
      manufacturer: (fd.get('manufacturer') as string) || null,
      model: (fd.get('model') as string) || null,
      serialNumber: (fd.get('serialNumber') as string) || null,
      inventoryNumber: (fd.get('inventoryNumber') as string) || null,
      purchaseDate: (fd.get('purchaseDate') as string) || null,
      purchasePrice: fd.get('purchasePrice')
        ? Number(fd.get('purchasePrice'))
        : null,
      status: fd.get('status') as string,
      condition: fd.get('condition') as string,
      notes: (fd.get('notes') as string) || null,
    };

    setSaving(true);
    equipmentApi
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

  const handleDelete = (): void => {
    equipmentApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/equipment');
      })
      .catch(() =>
        toast({ variant: 'destructive', description: t.toast.error }),
      );
  };

  const handleImageUpload = (file: File): void => {
    equipmentApi
      .uploadImage(id, file)
      .then(() => {
        toast({ description: t.toast.imageUploaded });
        load();
      })
      .catch(() =>
        toast({ variant: 'destructive', description: t.toast.error }),
      );
  };

  const handleAssign = (data: {
    workerId: string;
    expectedReturn?: string;
    notes?: string;
  }): void => {
    equipmentApi
      .assign(id, data)
      .then(() => {
        toast({ description: t.toast.assigned });
        setAssignOpen(false);
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  const handleReturn = (data: {
    returnNotes?: string;
    returnCondition?: string;
  }): void => {
    equipmentApi
      .returnEquipment(id, data)
      .then(() => {
        toast({ description: t.toast.returned });
        setReturnOpen(false);
        load();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      );
  };

  if (loading) {
    return <EquipmentDetailLoading />;
  }

  if (notFound || !equipment) {
    return <EquipmentDetailNotFound />;
  }

  return (
    <div className="space-y-6">
      <EquipmentDetailHeader
        equipment={equipment}
        onDelete={() => setDeleteOpen(true)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="master" className="min-h-[44px]">
            {t.tabs.master}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="min-h-[44px]">
            {t.tabs.assignments}
          </TabsTrigger>
        </TabsList>

        <EquipmentMasterTab
          equipment={equipment}
          saving={saving}
          onSave={handleSave}
          onImageUpload={handleImageUpload}
          onLightbox={setLightboxSrc}
        />

        <EquipmentAssignmentsTab
          equipment={equipment}
          onAssign={() => setAssignOpen(true)}
          onReturn={() => setReturnOpen(true)}
        />
      </Tabs>

      <EquipmentAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        workers={workers}
        onSubmit={handleAssign}
      />

      <EquipmentReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onSubmit={handleReturn}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.actions.delete}
        variant="destructive"
        onConfirm={handleDelete}
      />

      {lightboxSrc && (
        <EquipmentLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
