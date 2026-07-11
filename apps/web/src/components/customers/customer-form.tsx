'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { RouteButton } from '@/components/customers/contact-links';
import { useToast } from '@/components/ui/use-toast';
import { geocodeApi, type CustomerDetail } from '@/lib/customers';
import { texts } from '@/lib/texts';

const LEGAL_FORM_OPTIONS: ComboboxOption[] = [
  { value: 'GmbH', label: 'GmbH' },
  { value: 'AG', label: 'AG' },
  { value: 'KG', label: 'KG' },
  { value: 'OHG', label: 'OHG' },
  { value: 'GbR', label: 'GbR' },
  { value: 'UG (haftungsbeschränkt)', label: 'UG (haftungsbeschränkt)' },
  { value: 'e.K.', label: 'e.K.' },
  { value: 'GmbH & Co. KG', label: 'GmbH & Co. KG' },
  { value: 'Einzelunternehmen', label: 'Einzelunternehmen' },
  { value: 'Freiberufler', label: 'Freiberufler' },
  { value: 'eG', label: 'eG' },
  { value: 'SE', label: 'SE' },
  { value: 'Verein (e.V.)', label: 'Verein (e.V.)' },
  { value: 'Stiftung', label: 'Stiftung' },
];

const schema = z.object({
  companyName: z.string().min(1, 'Pflichtfeld'),
  legalForm: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  industry: z.string().optional(),
  rating: z.enum(['', 'A', 'B', 'C', 'D']).optional(),
  paymentTermDays: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  mapsUrl: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  vatId: z.string().optional(),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof schema>;

/**
 * Wandelt die Formularwerte in das API-Payload-Format.
 * Konvertiert Strings zu Zahlen (Koordinaten, Zahlungsziel) und
 * leere Strings zu undefined, damit sie nicht an die API gesendet werden.
 */
function toPayload(v: CustomerFormValues): Record<string, unknown> {
  const num = (s?: string): number | undefined => {
    if (s == null || s.trim() === '') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    companyName: v.companyName,
    legalForm: v.legalForm || undefined,
    status: v.status,
    industry: v.industry || undefined,
    rating: v.rating || undefined,
    paymentTermDays: num(v.paymentTermDays),
    addressLine1: v.addressLine1 || undefined,
    addressLine2: v.addressLine2 || undefined,
    postalCode: v.postalCode || undefined,
    city: v.city || undefined,
    country: v.country || undefined,
    latitude: num(v.latitude),
    longitude: num(v.longitude),
    mapsUrl: v.mapsUrl || undefined,
    phone: v.phone || undefined,
    website: v.website || undefined,
    vatId: v.vatId || undefined,
    taxNumber: v.taxNumber || undefined,
    notes: v.notes || undefined,
  };
}

interface CustomerFormProps {
  customer?: CustomerDetail;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

/**
 * Formular für die Stammdaten eines Kunden (Anlage und Bearbeitung).
 * Enthält Sektionen für Basisdaten, Adresse, Geo-Koordinaten (mit Geocoding),
 * Kontaktdaten, Steuerinformationen und Notizen.
 * Nutzt react-hook-form mit Zod-Validierung.
 *
 * @param customer - Bestehender Kunde (bei Bearbeitung), undefined bei Neuanlage
 * @param submitting - Ob gerade gespeichert wird (deaktiviert den Submit-Button)
 * @param onSubmit - Callback mit dem API-Payload beim Absenden
 * @param onCancel - Optionaler Callback für den Abbrechen-Button
 */
export function CustomerForm({
  customer,
  submitting,
  onSubmit,
  onCancel,
}: CustomerFormProps): ReactNode {
  const f = texts.customers.fields;
  const s = texts.customers.sections;
  const a = texts.customers.actions;
  const { toast } = useToast();
  const [geocoding, setGeocoding] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: customer?.companyName ?? '',
      legalForm: customer?.legalForm ?? '',
      status: customer?.status ?? 'ACTIVE',
      industry: customer?.industry ?? '',
      rating: (customer?.rating as CustomerFormValues['rating']) ?? '',
      paymentTermDays:
        customer?.paymentTermDays != null
          ? String(customer.paymentTermDays)
          : '',
      addressLine1: customer?.addressLine1 ?? '',
      addressLine2: customer?.addressLine2 ?? '',
      postalCode: customer?.postalCode ?? '',
      city: customer?.city ?? '',
      country: customer?.country ?? '',
      latitude: customer?.latitude != null ? String(customer.latitude) : '',
      longitude: customer?.longitude != null ? String(customer.longitude) : '',
      mapsUrl: customer?.mapsUrl ?? '',
      phone: customer?.phone ?? '',
      website: customer?.website ?? '',
      vatId: customer?.vatId ?? '',
      taxNumber: customer?.taxNumber ?? '',
      notes: customer?.notes ?? '',
    },
  });

  const status = watch('status');
  const rating = watch('rating');
  const addressLine1 = watch('addressLine1');
  const postalCode = watch('postalCode');
  const city = watch('city');
  const country = watch('country');
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const mapsUrl = watch('mapsUrl');

  /** Ermittelt Geo-Koordinaten und Maps-URL aus der eingegebenen Adresse per Geocoding-API. */
  const handleGeocode = (): void => {
    const address = [
      addressLine1,
      [postalCode, city].filter(Boolean).join(' '),
      country,
    ]
      .filter((p) => p && p.trim())
      .join(', ');
    setGeocoding(true);
    geocodeApi
      .lookup(address)
      .then((res) => {
        setValue('latitude', String(res.latitude));
        setValue('longitude', String(res.longitude));
        setValue('mapsUrl', res.mapsUrl);
        toast({ description: texts.customers.toast.geocoded });
      })
      .catch(() =>
        toast({
          variant: 'destructive',
          description: texts.customers.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))}
      className="space-y-8"
    >
      {/* Basisdaten */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{s.base}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.companyName} error={errors.companyName?.message} required>
            <Input {...register('companyName')} className="min-h-[44px]" />
          </Field>
          <Field label={f.legalForm}>
            <Combobox
              value={watch('legalForm') ?? ''}
              onChange={(val) => setValue('legalForm', val)}
              options={LEGAL_FORM_OPTIONS}
              placeholder="z.B. GmbH"
              className="min-h-[44px]"
            />
          </Field>
          {customer && (
            <Field label={f.customerNumber}>
              <Input
                value={customer.customerNumber}
                readOnly
                className="min-h-[44px] bg-muted font-mono"
              />
            </Field>
          )}
          <Field label={f.status}>
            <Select
              value={status}
              onValueChange={(val) =>
                setValue('status', val as 'ACTIVE' | 'INACTIVE')
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  {texts.customers.status.ACTIVE}
                </SelectItem>
                <SelectItem value="INACTIVE">
                  {texts.customers.status.INACTIVE}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.industry}>
            <Input {...register('industry')} className="min-h-[44px]" />
          </Field>
          <Field label={f.rating}>
            <Select
              value={rating || ''}
              onValueChange={(val) =>
                setValue('rating', val as CustomerFormValues['rating'])
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                {['A', 'B', 'C', 'D'].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.paymentTermDays}>
            <Input
              type="number"
              inputMode="numeric"
              {...register('paymentTermDays')}
              className="min-h-[44px]"
            />
          </Field>
        </div>
      </section>

      {/* Adresse */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.address}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.addressLine1} className="md:col-span-2">
            <Input {...register('addressLine1')} className="min-h-[44px]" />
          </Field>
          <Field label={f.addressLine2} className="md:col-span-2">
            <Input {...register('addressLine2')} className="min-h-[44px]" />
          </Field>
          <Field label={f.postalCode}>
            <Input {...register('postalCode')} className="min-h-[44px]" />
          </Field>
          <Field label={f.city}>
            <Input {...register('city')} className="min-h-[44px]" />
          </Field>
          <Field label={f.country}>
            <Input {...register('country')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Koordinaten & Karte */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.geo}
          </h3>
          <Button
            type="button"
            variant="outline"
            onClick={handleGeocode}
            disabled={geocoding || !addressLine1?.trim() || !city?.trim()}
            className="min-h-[44px]"
          >
            <MapPin className="h-4 w-4" />
            {geocoding ? a.geocoding : a.geocode}
          </Button>
        </div>
        {(latitude || longitude) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={f.latitude}>
              <Input
                value={latitude ?? ''}
                readOnly
                className="min-h-[44px] bg-muted"
              />
            </Field>
            <Field label={f.longitude}>
              <Input
                value={longitude ?? ''}
                readOnly
                className="min-h-[44px] bg-muted"
              />
            </Field>
          </div>
        )}
        <RouteButton
          latitude={latitude ? Number(latitude) : null}
          longitude={longitude ? Number(longitude) : null}
          mapsUrl={mapsUrl || null}
        />
      </section>

      {/* Kontakt & Steuer */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.contactInfo}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.phone}>
            <Input {...register('phone')} className="min-h-[44px]" />
          </Field>
          <Field label={f.website}>
            <Input {...register('website')} className="min-h-[44px]" />
          </Field>
          <Field label={f.vatId}>
            <Input {...register('vatId')} className="min-h-[44px]" />
          </Field>
          <Field label={f.taxNumber}>
            <Input {...register('taxNumber')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <Field label={f.notes}>
          <Textarea {...register('notes')} rows={4} />
        </Field>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="min-h-[44px]">
          {submitting ? a.saving : a.save}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="min-h-[44px]"
          >
            {a.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Wiederverwendbare Formularfeld-Komponente mit Label, Pflichtfeld-Markierung
 * und optionaler Fehlermeldung. Wird in allen Formularen der App verwendet.
 *
 * @param label - Beschriftung des Feldes
 * @param error - Optionale Fehlermeldung (z.B. aus Formular-Validierung)
 * @param required - Zeigt einen roten Stern neben dem Label an
 */
export function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
