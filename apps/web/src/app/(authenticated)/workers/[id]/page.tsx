/**
 * Seite: workers / detail (Office-Web).
 * Domänen-UI – ausführliche Handler-JSDocs nur bei nicht-trivialer Logik.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Power, PowerOff, Printer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { WorkerPrintAll } from '@/components/workers/worker-print-all';
import { PrintLetterhead } from '@/components/layout/app-brand';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  workerFullName,
  workersApi,
  type WorkerAvailability,
  type WorkerDetail,
} from '@/lib/workers';
import { ApiError } from '@/lib/api-client';
import {
  DEFAULT_PIN_LENGTH,
  kioskSettingsApi,
} from '@/lib/kiosk-settings';
import { texts } from '@/lib/texts';

const tabFallback = (
  <Skeleton className="h-64 w-full" aria-label={texts.common.loading} />
);

const WorkerDocumentsTab = dynamic(
  () =>
    import('@/components/workers/worker-documents-tab').then(
      (m) => m.WorkerDocumentsTab,
    ),
  { loading: () => tabFallback },
);
const WorkerSitePhotosTab = dynamic(
  () =>
    import('@/components/workers/worker-site-photos-tab').then(
      (m) => m.WorkerSitePhotosTab,
    ),
  { loading: () => tabFallback },
);
const WorkerQualificationsTab = dynamic(
  () =>
    import('@/components/workers/worker-qualifications-tab').then(
      (m) => m.WorkerQualificationsTab,
    ),
  { loading: () => tabFallback },
);
const WorkerContractTab = dynamic(
  () =>
    import('@/components/workers/worker-contract-tab').then(
      (m) => m.WorkerContractTab,
    ),
  { loading: () => tabFallback },
);
const WorkerEquipmentTab = dynamic(
  () =>
    import('@/components/workers/worker-equipment-tab').then(
      (m) => m.WorkerEquipmentTab,
    ),
  { loading: () => tabFallback },
);
const WorkerProjectsTab = dynamic(
  () =>
    import('@/components/workers/worker-projects-tab').then(
      (m) => m.WorkerProjectsTab,
    ),
  { loading: () => tabFallback },
);
const CommunicationTab = dynamic(
  () =>
    import('@/components/communication/communication-tab').then(
      (m) => m.CommunicationTab,
    ),
  { loading: () => tabFallback },
);

const AVAILABILITIES: WorkerAvailability[] = [
  'AVAILABLE',
  'ON_PROJECT',
  'SICK',
  'VACATION',
  'UNAVAILABLE',
];

/**
 * Detail-Seite eines einzelnen Monteurs/Mitarbeiters.
 * Zeigt Stammdaten, Dokumente, Qualifikationen, Vertrag, Equipment
 * und Projektzuweisungen in einem Tab-Layout.
 * Bietet Verfügbarkeitswechsel, Foto-Upload, PIN-Verwaltung,
 * Aktivierung/Deaktivierung und Löschen.
 */
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
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('master');
  const [printAll, setPrintAll] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  /** Lädt die vollständigen Mitarbeiterdaten inkl. aller Relationen vom API. */
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

  /** Ändert den Verfügbarkeitsstatus des Mitarbeiters (Verfügbar, Auf Projekt, Krank, etc.). */
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

  const handleDeactivate = (): void => {
    workersApi
      .update(id, { active: false })
      .then((w) => {
        setWorker(w);
        toast({ description: t.toast.deactivated });
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const handleReactivate = (): void => {
    workersApi
      .update(id, { active: true })
      .then((w) => {
        setWorker(w);
        toast({ description: t.toast.reactivated });
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  const handleDelete = (): void => {
    workersApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/workers');
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
    <div className={`space-y-6 ${printAll ? 'print-all-mode' : ''}`}>
      <PrintLetterhead />
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground no-print">
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
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="no-print min-h-[44px]">
                <Printer className="h-4 w-4" />
                {t.actions.print}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                {t.tabs.printTab}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPrintAll(true);
                  requestAnimationFrame(() => {
                    window.print();
                    setPrintAll(false);
                  });
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                {t.tabs.printAll}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {worker.active ? (
            <Button
              variant="outline"
              className="no-print min-h-[44px] text-amber-600"
              onClick={() => setDeactivateOpen(true)}
            >
              <PowerOff className="h-4 w-4" />
              {t.actions.deactivate}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="no-print min-h-[44px] text-emerald-600"
              onClick={handleReactivate}
            >
              <Power className="h-4 w-4" />
              {t.actions.reactivate}
            </Button>
          )}
          <Button
            variant="outline"
            className="no-print min-h-[44px] text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t.actions.delete}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-tabs-root>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="master" className="min-h-[44px]">
            {t.tabs.master}
          </TabsTrigger>
          <TabsTrigger value="documents" className="min-h-[44px]">
            {t.tabs.documents}
          </TabsTrigger>
          <TabsTrigger value="sitePhotos" className="min-h-[44px]">
            {t.tabs.sitePhotos}
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
          <TabsTrigger value="communication" className="min-h-[44px]">
            {texts.communication.title}
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

          <Card className="mt-4">
            <CardContent className="pt-6">
              <WorkerPinSection worker={worker} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <WorkerDocumentsTab worker={worker} onSaved={load} />
        </TabsContent>

        <TabsContent value="sitePhotos">
          <WorkerSitePhotosTab worker={worker} />
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

        <TabsContent value="communication">
          <CommunicationTab entityType="WORKER" entityId={worker.id} />
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
        title={t.deleteTitle}
        description={t.deleteConfirm}
        confirmLabel={t.actions.delete}
        variant="destructive"
        onConfirm={handleDelete}
      />

      <WorkerPrintAll ref={printRef} worker={worker} />
    </div>
  );
}

/**
 * Sektion zur PIN-Verwaltung eines Mitarbeiters.
 * Zeigt die hinterlegte Stempel-PIN an und erlaubt Setzen sowie E-Mail-Versand.
 */
function WorkerPinSection({ worker }: { worker: WorkerDetail }): React.ReactNode {
  const t = texts.workers.pin;
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [loadingPin, setLoadingPin] = useState(true);
  const [settingPin, setSettingPin] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [kioskAccess, setKioskAccess] = useState(true);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);

  const pinPattern = new RegExp(`^\\d{${pinLength}}$`);
  const isValid = pinPattern.test(pin);
  const pinForActions = isValid ? pin : currentPin;
  const canUseStored = Boolean(pinForActions && pinPattern.test(pinForActions));

  const toDateInput = (iso: string | null): string => {
    if (!iso) return '';
    return iso.slice(0, 10);
  };

  useEffect(() => {
    void kioskSettingsApi.getPublic().then((cfg) => {
      setPinLength(cfg.pinLength);
    });
  }, []);

  const loadPin = useCallback(() => {
    setLoadingPin(true);
    workersApi
      .getPin(worker.id)
      .then((res) => {
        setCurrentPin(res.pin);
        setHasPin(res.hasPin);
        if (res.pin) setPin(res.pin);
        setKioskAccess(res.kioskAccessEnabled);
        setValidFrom(toDateInput(res.validFrom));
        setValidTo(toDateInput(res.validTo));
      })
      .catch(() => {
        setCurrentPin(null);
        setHasPin(false);
      })
      .finally(() => setLoadingPin(false));
  }, [worker.id]);

  useEffect(() => {
    loadPin();
  }, [loadPin]);

  const handleSetPin = async (): Promise<void> => {
    if (!isValid) return;
    setSettingPin(true);
    try {
      await workersApi.setPin(worker.id, pin, {
        validFrom: validFrom || undefined,
        validTo: validTo || null,
        kioskAccessEnabled: kioskAccess,
      });
      setCurrentPin(pin);
      setHasPin(true);
      toast({ description: texts.workers.toast.pinSet });
      loadPin();
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : texts.workers.toast.error,
      });
    } finally {
      setSettingPin(false);
    }
  };

  const handleSendEmail = async (): Promise<void> => {
    if (!canUseStored || !pinForActions) return;
    if (!worker.email) {
      toast({ variant: 'destructive', description: t.noEmail });
      return;
    }
    setSendingEmail(true);
    try {
      const result = await workersApi.sendPinEmail(worker.id, pinForActions);
      if (result.success) {
        setCurrentPin(pinForActions);
        setHasPin(true);
        toast({ description: texts.workers.toast.pinEmailSent });
      } else {
        toast({
          variant: 'destructive',
          description: result.error ?? texts.workers.toast.pinEmailFailed,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof ApiError ? err.message : texts.workers.toast.error,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      <p className="text-xs text-muted-foreground">{t.hint}</p>

      {loadingPin ? (
        <Skeleton className="h-12 w-48" />
      ) : currentPin ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">{t.current}</p>
          <p className="font-mono text-2xl font-semibold tracking-[0.35em]">
            {currentPin}
          </p>
        </div>
      ) : hasPin ? (
        <p className="text-sm text-amber-600 dark:text-amber-500">{t.legacy}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t.none}</p>
      )}

      <label className="flex min-h-[44px] cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={kioskAccess}
          onChange={(e) => setKioskAccess(e.target.checked)}
        />
        <span>
          <span className="font-medium">{t.kioskAccess}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t.kioskAccessHint}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>{t.validFrom}</Label>
          <Input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="min-h-[44px] w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t.validTo}</Label>
          <Input
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="min-h-[44px] w-40"
          />
          <p className="text-[10px] text-muted-foreground">{t.validToHint}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>{t.label.replace('{n}', String(pinLength))}</Label>
          <Input
            type="text"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, pinLength);
              setPin(v);
            }}
            placeholder={'0'.repeat(pinLength)}
            maxLength={pinLength}
            inputMode="numeric"
            className="min-h-[44px] w-36 font-mono text-lg tracking-widest"
          />
        </div>
        <Button
          className="min-h-[44px]"
          disabled={!isValid || settingPin}
          onClick={handleSetPin}
        >
          {settingPin ? t.setting : t.set}
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={!canUseStored || sendingEmail || !worker.email}
          onClick={handleSendEmail}
        >
          {sendingEmail ? t.sending : t.sendEmail}
        </Button>
      </div>
      {pin.length > 0 && !isValid && (
        <p className="text-xs text-destructive">
          {t.validation.replace('{n}', String(pinLength))}
        </p>
      )}
    </div>
  );
}
