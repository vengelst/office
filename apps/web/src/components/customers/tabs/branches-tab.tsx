'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  MailLink,
  PhoneLink,
  RouteButton,
} from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  customersApi,
  geocodeApi,
  type CustomerBranch,
  type CustomerContact,
} from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { joinAddress } from '@/lib/format';
import { texts } from '@/lib/texts';

const BRANCH_TYPES = [
  'HEADQUARTERS',
  'OFFICE',
  'WAREHOUSE',
  'SITE',
  'OTHER',
] as const;

type FormState = {
  name: string;
  branchType: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  mapsUrl: string;
  phone: string;
  email: string;
  notes: string;
};

const EMPTY: FormState = {
  name: '',
  branchType: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  latitude: '',
  longitude: '',
  mapsUrl: '',
  phone: '',
  email: '',
  notes: '',
};

/**
 * Tab-Komponente zur Verwaltung von Niederlassungen (Standorten) eines Kunden.
 * Bietet CRUD-Operationen, Geocoding von Adressen via Google Maps,
 * eine Detail-Ansicht mit zugeordneten Ansprechpartnern und Routenplanung.
 *
 * @param customerId - ID des zugehörigen Kunden
 * @param branches - Liste der Niederlassungen
 * @param contacts - Alle Ansprechpartner des Kunden (für die Standort-Detail-Ansicht)
 * @param onChange - Callback bei Datenänderung
 * @param onOpenContact - Callback zum Öffnen eines Kontakts im Kontakte-Tab
 * @param onAddContact - Callback zum Anlegen eines neuen Kontakts für eine Niederlassung
 */
export function BranchesTab({
  customerId,
  branches,
  contacts,
  onChange,
  onOpenContact,
  onAddContact,
}: {
  customerId: string;
  branches: CustomerBranch[];
  contacts: CustomerContact[];
  onChange: () => void;
  onOpenContact?: (contact: CustomerContact) => void;
  onAddContact?: (branchId: string) => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerBranch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [detail, setDetail] = useState<CustomerBranch | null>(null);

  const set = (k: keyof FormState, v: string): void =>
    setForm((prev) => ({ ...prev, [k]: v }));

  /** Ermittelt Geo-Koordinaten und Google-Maps-URL aus der eingegebenen Adresse. */
  const handleGeocode = (): void => {
    const address = [
      form.addressLine1,
      [form.postalCode, form.city].filter(Boolean).join(' '),
      form.country,
    ]
      .filter((p) => p && p.trim())
      .join(', ');
    setGeocoding(true);
    geocodeApi
      .lookup(address)
      .then((res) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(res.latitude),
          longitude: String(res.longitude),
          mapsUrl: res.mapsUrl,
        }));
        toast({ description: t.toast.geocoded });
      })
      .catch(() =>
        toast({
          variant: 'destructive',
          description: t.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (b: CustomerBranch): void => {
    setEditing(b);
    setForm({
      name: b.name,
      branchType: b.branchType ?? '',
      addressLine1: b.addressLine1 ?? '',
      addressLine2: b.addressLine2 ?? '',
      postalCode: b.postalCode ?? '',
      city: b.city ?? '',
      country: b.country ?? '',
      latitude: b.latitude != null ? String(b.latitude) : '',
      longitude: b.longitude != null ? String(b.longitude) : '',
      mapsUrl: b.mapsUrl ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      notes: b.notes ?? '',
    });
    setDialogOpen(true);
  };

  const save = (): void => {
    const num = (s: string): number | undefined =>
      s.trim() === '' ? undefined : Number(s);
    const payload = {
      name: form.name,
      branchType: form.branchType || undefined,
      addressLine1: form.addressLine1 || undefined,
      addressLine2: form.addressLine2 || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      latitude: num(form.latitude),
      longitude: num(form.longitude),
      mapsUrl: form.mapsUrl || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      notes: form.notes || undefined,
    };
    setSaving(true);
    const req = editing
      ? customersApi.updateBranch(customerId, editing.id, payload)
      : customersApi.createBranch(customerId, payload);
    req
      .then(() => {
        toast({ description: t.toast.updated });
        setDialogOpen(false);
        onChange();
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
    customersApi
      .removeBranch(customerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const typeLabel = (type?: string | null): string | null =>
    type ? (t.branchTypes[type as keyof typeof t.branchTypes] ?? type) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addBranch}
        </Button>
      </div>

      {branches.length === 0 ? (
        <EmptyState
          message={t.empties.branches}
          actionLabel={t.empties.addNow}
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetail(b)}
                    className="flex flex-1 flex-wrap items-center gap-2 text-left"
                  >
                    <span className="font-medium hover:underline">
                      {b.name}
                    </span>
                    {typeLabel(b.branchType) && (
                      <Badge variant="secondary">
                        {typeLabel(b.branchType)}
                      </Badge>
                    )}
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => setDetail(b)}
                      aria-label={t.actions.details}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => openEdit(b)}
                      aria-label={t.actions.edit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive"
                      onClick={() => setDeleteId(b.id)}
                      aria-label={t.actions.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {joinAddress(b) && (
                  <p className="text-sm text-muted-foreground">
                    {joinAddress(b)}
                  </p>
                )}
                <div className="flex flex-col gap-1 text-sm">
                  {b.phone && <PhoneLink phone={b.phone} />}
                  {b.email && <MailLink email={b.email} />}
                </div>
                <RouteButton
                  latitude={b.latitude}
                  longitude={b.longitude}
                  mapsUrl={b.mapsUrl}
                  address={joinAddress(b)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.actions.edit : t.actions.addBranch}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.branchName} required>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.branchType}>
                <Select
                  value={form.branchType}
                  onValueChange={(v) => set('branchType', v)}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {typeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={t.fields.addressLine1}>
              <Input
                value={form.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={t.fields.postalCode}>
                <Input
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.city}>
                <Input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.country}>
                <Input
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  {t.coordinates}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeocode}
                  disabled={
                    geocoding ||
                    !form.addressLine1.trim() ||
                    !form.city.trim()
                  }
                  className="min-h-[44px]"
                >
                  <MapPin className="h-4 w-4" />
                  {geocoding ? t.actions.geocoding : t.actions.geocode}
                </Button>
              </div>
              {(form.latitude || form.longitude) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={t.fields.latitude}>
                    <Input
                      value={form.latitude}
                      readOnly
                      className="min-h-[44px] bg-muted"
                    />
                  </Field>
                  <Field label={t.fields.longitude}>
                    <Input
                      value={form.longitude}
                      readOnly
                      className="min-h-[44px] bg-muted"
                    />
                  </Field>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t.fields.phone}>
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={t.fields.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
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
              onClick={save}
              disabled={saving || !form.name}
              className="min-h-[44px]"
            >
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {detail.name}
                  {typeLabel(detail.branchType) && (
                    <Badge variant="secondary">
                      {typeLabel(detail.branchType)}
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {joinAddress(detail) && (
                  <p className="text-sm text-muted-foreground">
                    {joinAddress(detail)}
                  </p>
                )}
                {(detail.phone || detail.email) && (
                  <div className="flex flex-col gap-1 text-sm">
                    {detail.phone && <PhoneLink phone={detail.phone} />}
                    {detail.email && <MailLink email={detail.email} />}
                  </div>
                )}
                <RouteButton
                  latitude={detail.latitude}
                  longitude={detail.longitude}
                  mapsUrl={detail.mapsUrl}
                  address={joinAddress(detail)}
                />
                {detail.notes && (
                  <p className="whitespace-pre-wrap text-sm">{detail.notes}</p>
                )}

                <div className="space-y-2 border-t pt-4">
                  {(() => {
                    const branchContacts = contacts.filter(
                      (c) => c.branchId === detail.id,
                    );
                    return (
                      <>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          {t.branchContacts} ({branchContacts.length})
                        </h4>
                        {branchContacts.length === 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {t.branchContactsEmpty}
                            </p>
                            {onAddContact && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px]"
                                onClick={() => {
                                  setDetail(null);
                                  onAddContact(detail.id);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                {t.actions.addContact}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {branchContacts.map((c) => (
                              <div
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setDetail(null);
                                  onOpenContact?.(c);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setDetail(null);
                                    onOpenContact?.(c);
                                  }
                                }}
                                className="w-full cursor-pointer rounded-md border p-3 text-left transition-colors hover:bg-accent"
                              >
                                <p className="font-medium">
                                  {[c.title, c.firstName, c.lastName]
                                    .filter(Boolean)
                                    .join(' ')}
                                </p>
                                {(c.role || c.department) && (
                                  <p className="text-sm text-muted-foreground">
                                    {[c.role, c.department]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>
                                )}
                                <div
                                  className="mt-1 flex flex-col gap-0.5 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {c.email && <MailLink email={c.email} />}
                                  {c.phoneMobile && (
                                    <PhoneLink phone={c.phoneMobile} mobile />
                                  )}
                                  {c.phoneLandline && (
                                    <PhoneLink phone={c.phoneLandline} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDetail(null)}
                  className="min-h-[44px]"
                >
                  {t.actions.close}
                </Button>
                <Button
                  onClick={() => {
                    const b = detail;
                    setDetail(null);
                    openEdit(b);
                  }}
                  className="min-h-[44px]"
                >
                  <Pencil className="h-4 w-4" />
                  {t.actions.edit}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
