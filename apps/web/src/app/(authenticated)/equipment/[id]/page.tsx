'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronRight,
  Trash2,
  Upload,
  ArrowLeftRight,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import { TOKEN_STORAGE_KEY } from '@/lib/api-client';
import {
  equipmentApi,
  EQUIPMENT_STATUSES,
  EQUIPMENT_CONDITIONS,
  type EquipmentDetail,
  type EquipmentWorker,
  type EquipmentAssignment,
} from '@/lib/equipment';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

const statusColor: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_REPAIR: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  RETIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const NONE = '__none__';

function fmtDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE');
}

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
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !equipment) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/equipment">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/equipment" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{equipment.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {equipment.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {equipment.category && (
              <Badge variant="outline">{equipment.category}</Badge>
            )}
            <Badge
              variant="secondary"
              className={statusColor[equipment.status] ?? ''}
            >
              {t.status[equipment.status]}
            </Badge>
            {equipment.inventoryNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {equipment.inventoryNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </TabsList>

        <TabsContent value="master" className="mt-4 space-y-4">
          {/* Bild */}
          <Card>
            <CardContent className="pt-6">
              <EquipmentImage
                equipmentId={equipment.id}
                hasImage={!!equipment.imageKey}
                onUpload={handleImageUpload}
                onLightbox={(src) => setLightboxSrc(src)}
              />
            </CardContent>
          </Card>

          {/* Formular */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t.sections.base}</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="name">{t.fields.name} *</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={equipment.name}
                        required
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="description">
                        {t.fields.description}
                      </Label>
                      <Textarea
                        id="description"
                        name="description"
                        defaultValue={equipment.description ?? ''}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="category">{t.fields.category}</Label>
                      <Input
                        id="category"
                        name="category"
                        defaultValue={equipment.category ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="manufacturer">
                        {t.fields.manufacturer}
                      </Label>
                      <Input
                        id="manufacturer"
                        name="manufacturer"
                        defaultValue={equipment.manufacturer ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="model">{t.fields.model}</Label>
                      <Input
                        id="model"
                        name="model"
                        defaultValue={equipment.model ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="serialNumber">
                        {t.fields.serialNumber}
                      </Label>
                      <Input
                        id="serialNumber"
                        name="serialNumber"
                        defaultValue={equipment.serialNumber ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inventoryNumber">
                        {t.fields.inventoryNumber}
                      </Label>
                      <Input
                        id="inventoryNumber"
                        name="inventoryNumber"
                        defaultValue={equipment.inventoryNumber ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">
                    {t.sections.purchase}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="purchaseDate">
                        {t.fields.purchaseDate}
                      </Label>
                      <Input
                        id="purchaseDate"
                        name="purchaseDate"
                        type="date"
                        defaultValue={
                          equipment.purchaseDate
                            ? equipment.purchaseDate.slice(0, 10)
                            : ''
                        }
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="purchasePrice">
                        {t.fields.purchasePrice} (€)
                      </Label>
                      <Input
                        id="purchasePrice"
                        name="purchasePrice"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={equipment.purchasePrice ?? ''}
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t.sections.state}</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t.fields.status}</Label>
                      <Select
                        name="status"
                        defaultValue={equipment.status}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {t.status[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.fields.condition}</Label>
                      <Select
                        name="condition"
                        defaultValue={equipment.condition}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {t.condition[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t.sections.notes}</h3>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={equipment.notes ?? ''}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="min-h-[44px]"
                    disabled={saving}
                  >
                    {saving ? t.actions.saving : t.actions.save}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-4">
          {/* Aktuelle Zuweisung */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                {equipment.currentAssignment ? (
                  <div>
                    <p className="text-sm font-semibold text-blue-600">
                      {t.history.current}
                    </p>
                    <p className="mt-1">
                      <Link
                        href={`/workers/${equipment.currentAssignment.worker.id}`}
                        className="font-medium hover:underline"
                      >
                        {equipment.currentAssignment.worker.firstName}{' '}
                        {equipment.currentAssignment.worker.lastName}
                      </Link>
                      <span className="ml-2 text-sm text-muted-foreground">
                        seit {fmtDate(equipment.currentAssignment.assignedAt)}
                      </span>
                    </p>
                    {equipment.currentAssignment.expectedReturn && (
                      <p className="text-sm text-muted-foreground">
                        {t.history.expected}:{' '}
                        {fmtDate(equipment.currentAssignment.expectedReturn)}
                      </p>
                    )}
                    {equipment.currentAssignment.notes && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {equipment.currentAssignment.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aktuell nicht ausgegeben
                  </p>
                )}
                <div className="flex gap-2">
                  {equipment.currentAssignment ? (
                    <Button
                      className="min-h-[44px]"
                      variant="outline"
                      onClick={() => setReturnOpen(true)}
                    >
                      <CornerDownLeft className="mr-1 h-4 w-4" />
                      {t.return.button}
                    </Button>
                  ) : (
                    <Button
                      className="min-h-[44px]"
                      onClick={() => setAssignOpen(true)}
                    >
                      <ArrowLeftRight className="mr-1 h-4 w-4" />
                      {t.assign.button}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historie */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold">
                {t.history.title}
              </h3>
              {equipment.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine vergangenen Zuweisungen.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.history.worker}</TableHead>
                      <TableHead>{t.history.assignedAt}</TableHead>
                      <TableHead>{t.history.returnedAt}</TableHead>
                      <TableHead>{t.history.condition}</TableHead>
                      <TableHead>{t.history.notes}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.history.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link
                            href={`/workers/${a.worker.id}`}
                            className="hover:underline"
                          >
                            {a.worker.firstName} {a.worker.lastName}
                          </Link>
                        </TableCell>
                        <TableCell>{fmtDate(a.assignedAt)}</TableCell>
                        <TableCell>{fmtDate(a.returnedAt)}</TableCell>
                        <TableCell>
                          {a.returnCondition
                            ? t.condition[a.returnCondition]
                            : '–'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {a.notes || a.returnNotes || '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialoge */}
      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        workers={workers}
        onSubmit={handleAssign}
      />

      <ReturnDialog
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

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute right-4 top-4 text-white"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="Gerätebild"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/** Authentifiziertes Bild mit Lightbox-Unterstützung. */
function EquipmentImage({
  equipmentId,
  hasImage,
  onUpload,
  onLightbox,
}: {
  equipmentId: string;
  hasImage: boolean;
  onUpload: (file: File) => void;
  onLightbox: (src: string) => void;
}): React.ReactNode {
  const t = texts.equipment;
  const fileRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImage) {
      setBlobUrl(null);
      return;
    }
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

    let objectUrl: string | undefined;
    fetch(`${API_BASE_URL}/equipment/${equipmentId}/image`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error('load failed');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [equipmentId, hasImage]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      {blobUrl ? (
        <img
          src={blobUrl}
          alt="Gerätebild"
          className="h-40 w-40 cursor-pointer rounded-lg border object-cover transition-opacity hover:opacity-90"
          onClick={() => onLightbox(blobUrl)}
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          {t.fields.image}
        </div>
      )}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {hasImage ? t.actions.changeImage : t.actions.uploadImage}
        </Button>
      </div>
    </div>
  );
}

/** Dialog: Gerät an Monteur ausgeben. */
function AssignDialog({
  open,
  onOpenChange,
  workers,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workers: EquipmentWorker[];
  onSubmit: (data: {
    workerId: string;
    expectedReturn?: string;
    notes?: string;
  }) => void;
}): React.ReactNode {
  const t = texts.equipment.assign;
  const [workerId, setWorkerId] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!workerId) return;
    const fd = new FormData(e.currentTarget);
    onSubmit({
      workerId,
      expectedReturn: (fd.get('expectedReturn') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.worker} *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Monteur wählen …" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.firstName} {w.lastName} ({w.workerNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expectedReturn">{t.expectedReturn}</Label>
            <Input
              id="expectedReturn"
              name="expectedReturn"
              type="date"
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignNotes">{t.notes}</Label>
            <Textarea id="assignNotes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-[44px]" disabled={!workerId}>
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog: Rückgabe registrieren. */
function ReturnDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: {
    returnNotes?: string;
    returnCondition?: string;
  }) => void;
}): React.ReactNode {
  const t = texts.equipment.return;
  const condT = texts.equipment.condition;
  const [condition, setCondition] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      returnNotes: (fd.get('returnNotes') as string) || undefined,
      returnCondition: condition || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.condition}</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Zustand wählen …" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {condT[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="returnNotes">{t.notes}</Label>
            <Textarea id="returnNotes" name="returnNotes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" className="min-h-[44px]">
              {t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
