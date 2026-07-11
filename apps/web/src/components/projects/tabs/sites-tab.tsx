'use client';

import { useState, type ReactNode } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/customers/customer-form';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { RouteButton } from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { geocodeApi } from '@/lib/customers';
import { projectsApi, type ProjectDetail, type ProjectSite } from '@/lib/projects';
import { ApiError } from '@/lib/api-client';
import { joinAddress } from '@/lib/format';
import { texts } from '@/lib/texts';

const num = (s: string): number | undefined =>
  s.trim() === '' ? undefined : Number(s);

/** Fügt Adressbestandteile zu einem Geocoding-tauglichen String zusammen. */
function buildAddress(parts: {
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
}): string {
  return [
    parts.addressLine1,
    [parts.postalCode, parts.city].filter(Boolean).join(' '),
    parts.country,
  ]
    .filter((p) => p && p.trim())
    .join(', ');
}

/**
 * Tab-Komponente zur Verwaltung aller Standortinformationen eines Projekts.
 * Gliedert sich in drei Bereiche: Hauptstandort (direkt am Projekt),
 * zusätzliche Standorte (ProjectSites) und Unterkunft für Monteure.
 *
 * @param project - Das aktuelle Projekt mit allen Standortdaten
 * @param onChange - Callback bei Datenänderung (löst Neuladen aus)
 */
export function SitesTab({
  project,
  onChange,
}: {
  project: ProjectDetail;
  onChange: () => void;
}): ReactNode {
  return (
    <div className="space-y-8">
      <MainSite project={project} onChange={onChange} />
      <SitesList project={project} onChange={onChange} />
      <Accommodation project={project} onChange={onChange} />
    </div>
  );
}

// ── Hauptstandort ──────────────────────────────────────────────

/**
 * Bearbeitungsbereich für den Hauptstandort eines Projekts.
 * Speichert Adresse, Geo-Koordinaten, Zugangsinfos und Arbeitszeiten
 * direkt auf dem Projekt-Objekt.
 */
function MainSite({
  project,
  onChange,
}: {
  project: ProjectDetail;
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({
    siteName: project.siteName ?? '',
    siteAddressLine1: project.siteAddressLine1 ?? '',
    sitePostalCode: project.sitePostalCode ?? '',
    siteCity: project.siteCity ?? '',
    siteCountry: project.siteCountry ?? '',
    latitude: project.latitude != null ? String(project.latitude) : '',
    longitude: project.longitude != null ? String(project.longitude) : '',
    mapsUrl: project.mapsUrl ?? '',
    siteAccessInfo: project.siteAccessInfo ?? '',
    siteWorkingHours: project.siteWorkingHours ?? '',
  });

  const set = (k: keyof typeof form, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleGeocode = (): void => {
    const address = buildAddress({
      addressLine1: form.siteAddressLine1,
      postalCode: form.sitePostalCode,
      city: form.siteCity,
      country: form.siteCountry,
    });
    setGeocoding(true);
    geocodeApi
      .lookup(address)
      .then((res) =>
        setForm((p) => ({
          ...p,
          latitude: String(res.latitude),
          longitude: String(res.longitude),
          mapsUrl: res.mapsUrl,
        })),
      )
      .catch(() =>
        toast({
          variant: 'destructive',
          description: texts.customers.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  const save = (): void => {
    setSaving(true);
    projectsApi
      .update(project.id, {
        siteName: form.siteName || null,
        siteAddressLine1: form.siteAddressLine1 || null,
        sitePostalCode: form.sitePostalCode || null,
        siteCity: form.siteCity || null,
        siteCountry: form.siteCountry || null,
        latitude: num(form.latitude) ?? null,
        longitude: num(form.longitude) ?? null,
        mapsUrl: form.mapsUrl || null,
        siteAccessInfo: form.siteAccessInfo || null,
        siteWorkingHours: form.siteWorkingHours || null,
      })
      .then(() => {
        toast({ description: t.toast.updated });
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{t.sections.site}</h3>
        <Button
          type="button"
          variant="outline"
          onClick={handleGeocode}
          disabled={
            geocoding || !form.siteAddressLine1.trim() || !form.siteCity.trim()
          }
          className="min-h-[44px]"
        >
          <MapPin className="h-4 w-4" />
          {geocoding ? texts.customers.actions.geocoding : texts.customers.actions.geocode}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={f.siteName} className="md:col-span-2">
          <Input
            value={form.siteName}
            onChange={(e) => set('siteName', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.addressLine1} className="md:col-span-2">
          <Input
            value={form.siteAddressLine1}
            onChange={(e) => set('siteAddressLine1', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.postalCode}>
          <Input
            value={form.sitePostalCode}
            onChange={(e) => set('sitePostalCode', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.city}>
          <Input
            value={form.siteCity}
            onChange={(e) => set('siteCity', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.country}>
          <Input
            value={form.siteCountry}
            onChange={(e) => set('siteCountry', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        {(form.latitude || form.longitude) && (
          <>
            <Field label={f.latitude}>
              <Input value={form.latitude} readOnly className="min-h-[44px] bg-muted" />
            </Field>
            <Field label={f.longitude}>
              <Input value={form.longitude} readOnly className="min-h-[44px] bg-muted" />
            </Field>
          </>
        )}
        <Field label={f.accessInfo} className="md:col-span-2">
          <Textarea
            value={form.siteAccessInfo}
            onChange={(e) => set('siteAccessInfo', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label={f.workingHours} className="md:col-span-2">
          <Input
            value={form.siteWorkingHours}
            onChange={(e) => set('siteWorkingHours', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving} className="min-h-[44px]">
          {saving ? t.actions.saving : t.actions.save}
        </Button>
        <RouteButton
          latitude={num(form.latitude) ?? null}
          longitude={num(form.longitude) ?? null}
          mapsUrl={form.mapsUrl || null}
        />
      </div>
    </section>
  );
}

// ── Standort-Liste (ProjectSites) ──────────────────────────────

type SiteForm = {
  name: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  mapsUrl: string;
  accessInfo: string;
  notes: string;
};

const EMPTY_SITE: SiteForm = {
  name: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  country: '',
  latitude: '',
  longitude: '',
  mapsUrl: '',
  accessInfo: '',
  notes: '',
};

/**
 * Verwaltung zusätzlicher Projektstandorte mit CRUD-Operationen.
 * Jeder Standort hat eigene Adresse, Koordinaten und Zugangsinfos.
 */
function SitesList({
  project,
  onChange,
}: {
  project: ProjectDetail;
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSite | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState<SiteForm>(EMPTY_SITE);

  const set = (k: keyof SiteForm, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const openCreate = (): void => {
    setEditing(null);
    setForm(EMPTY_SITE);
    setDialogOpen(true);
  };

  const openEdit = (s: ProjectSite): void => {
    setEditing(s);
    setForm({
      name: s.name,
      addressLine1: s.addressLine1 ?? '',
      postalCode: s.postalCode ?? '',
      city: s.city ?? '',
      country: s.country ?? '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      mapsUrl: s.mapsUrl ?? '',
      accessInfo: s.accessInfo ?? '',
      notes: s.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleGeocode = (): void => {
    const address = buildAddress(form);
    setGeocoding(true);
    geocodeApi
      .lookup(address)
      .then((res) =>
        setForm((p) => ({
          ...p,
          latitude: String(res.latitude),
          longitude: String(res.longitude),
          mapsUrl: res.mapsUrl,
        })),
      )
      .catch(() =>
        toast({
          variant: 'destructive',
          description: texts.customers.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  const save = (): void => {
    const payload = {
      name: form.name,
      addressLine1: form.addressLine1 || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      latitude: num(form.latitude),
      longitude: num(form.longitude),
      mapsUrl: form.mapsUrl || undefined,
      accessInfo: form.accessInfo || undefined,
      notes: form.notes || undefined,
    };
    setSaving(true);
    const req = editing
      ? projectsApi.updateSite(project.id, editing.id, payload)
      : projectsApi.createSite(project.id, payload);
    req
      .then(() => {
        toast({ description: editing ? t.toast.updated : t.toast.siteAdded });
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
    projectsApi
      .removeSite(project.id, deleteId)
      .then(() => {
        toast({ description: t.toast.siteDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{t.tabs.standorte}</h3>
        <Button onClick={openCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          {t.actions.addSite}
        </Button>
      </div>

      {project.sites.length === 0 ? (
        <EmptyState message={t.empties.sites} actionLabel={t.empties.addNow} onAction={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {project.sites.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => openEdit(s)}
                      aria-label={t.actions.edit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive"
                      onClick={() => setDeleteId(s.id)}
                      aria-label={t.actions.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {joinAddress(s) && (
                  <p className="text-sm text-muted-foreground">{joinAddress(s)}</p>
                )}
                {s.accessInfo && (
                  <p className="text-sm">{s.accessInfo}</p>
                )}
                <RouteButton
                  latitude={s.latitude}
                  longitude={s.longitude}
                  mapsUrl={s.mapsUrl}
                  address={joinAddress(s)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.actions.edit : t.actions.addSite}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={f.siteName} required>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.addressLine1}>
              <Input
                value={form.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
                className="min-h-[44px]"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label={f.postalCode}>
                <Input
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.city}>
                <Input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
              <Field label={f.country}>
                <Input
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  className="min-h-[44px]"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                {t.coordinates}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocode}
                disabled={geocoding || !form.addressLine1.trim() || !form.city.trim()}
                className="min-h-[44px]"
              >
                <MapPin className="h-4 w-4" />
                {geocoding
                  ? texts.customers.actions.geocoding
                  : texts.customers.actions.geocode}
              </Button>
            </div>
            {(form.latitude || form.longitude) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label={f.latitude}>
                  <Input value={form.latitude} readOnly className="min-h-[44px] bg-muted" />
                </Field>
                <Field label={f.longitude}>
                  <Input value={form.longitude} readOnly className="min-h-[44px] bg-muted" />
                </Field>
              </div>
            )}
            <Field label={f.accessInfo}>
              <Textarea
                value={form.accessInfo}
                onChange={(e) => set('accessInfo', e.target.value)}
                rows={2}
              />
            </Field>
            <Field label={f.notes}>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
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
            <Button onClick={save} disabled={saving || !form.name} className="min-h-[44px]">
              {saving ? t.actions.saving : t.actions.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.actions.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

// ── Unterkunft ─────────────────────────────────────────────────

/**
 * Bearbeitungsbereich für die Monteur-Unterkunft eines Projekts.
 * Speichert Adresse, Geo-Koordinaten und Notizen direkt auf dem Projekt.
 */
function Accommodation({
  project,
  onChange,
}: {
  project: ProjectDetail;
  onChange: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.projects;
  const f = t.fields;
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({
    addressLine1: project.accommodationAddressLine1 ?? '',
    addressLine2: project.accommodationAddressLine2 ?? '',
    postalCode: project.accommodationPostalCode ?? '',
    city: project.accommodationCity ?? '',
    country: project.accommodationCountry ?? '',
    latitude:
      project.accommodationLatitude != null
        ? String(project.accommodationLatitude)
        : '',
    longitude:
      project.accommodationLongitude != null
        ? String(project.accommodationLongitude)
        : '',
    mapsUrl: project.accommodationMapsUrl ?? '',
    notes: project.accommodationNotes ?? '',
  });

  const set = (k: keyof typeof form, v: string): void =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleGeocode = (): void => {
    const address = buildAddress(form);
    setGeocoding(true);
    geocodeApi
      .lookup(address)
      .then((res) =>
        setForm((p) => ({
          ...p,
          latitude: String(res.latitude),
          longitude: String(res.longitude),
          mapsUrl: res.mapsUrl,
        })),
      )
      .catch(() =>
        toast({
          variant: 'destructive',
          description: texts.customers.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  const save = (): void => {
    setSaving(true);
    projectsApi
      .update(project.id, {
        accommodationAddressLine1: form.addressLine1 || null,
        accommodationAddressLine2: form.addressLine2 || null,
        accommodationPostalCode: form.postalCode || null,
        accommodationCity: form.city || null,
        accommodationCountry: form.country || null,
        accommodationLatitude: num(form.latitude) ?? null,
        accommodationLongitude: num(form.longitude) ?? null,
        accommodationMapsUrl: form.mapsUrl || null,
        accommodationNotes: form.notes || null,
      })
      .then(() => {
        toast({ description: t.toast.updated });
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

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t.sections.accommodation}
        </h3>
        <Button
          type="button"
          variant="outline"
          onClick={handleGeocode}
          disabled={geocoding || !form.addressLine1.trim() || !form.city.trim()}
          className="min-h-[44px]"
        >
          <MapPin className="h-4 w-4" />
          {geocoding
            ? texts.customers.actions.geocoding
            : texts.customers.actions.geocode}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={f.addressLine1} className="md:col-span-2">
          <Input
            value={form.addressLine1}
            onChange={(e) => set('addressLine1', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.addressLine2} className="md:col-span-2">
          <Input
            value={form.addressLine2}
            onChange={(e) => set('addressLine2', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.postalCode}>
          <Input
            value={form.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.city}>
          <Input
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        <Field label={f.country}>
          <Input
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            className="min-h-[44px]"
          />
        </Field>
        {(form.latitude || form.longitude) && (
          <>
            <Field label={f.latitude}>
              <Input value={form.latitude} readOnly className="min-h-[44px] bg-muted" />
            </Field>
            <Field label={f.longitude}>
              <Input value={form.longitude} readOnly className="min-h-[44px] bg-muted" />
            </Field>
          </>
        )}
        <Field label={f.accommodationNotes} className="md:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving} className="min-h-[44px]">
          {saving ? t.actions.saving : t.actions.save}
        </Button>
        <RouteButton
          latitude={num(form.latitude) ?? null}
          longitude={num(form.longitude) ?? null}
          mapsUrl={form.mapsUrl || null}
        />
      </div>
    </section>
  );
}
