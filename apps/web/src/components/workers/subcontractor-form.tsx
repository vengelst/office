'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/customers/customer-form';
import { RouteButton } from '@/components/customers/contact-links';
import { useToast } from '@/components/ui/use-toast';
import { geocodeApi } from '@/lib/customers';
import type { SubcontractorDetail } from '@/lib/workers';
import { texts } from '@/lib/texts';

const schema = z.object({
  name: z.string().min(1, 'Pflichtfeld'),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  mapsUrl: z.string().optional(),
  taxNumber: z.string().optional(),
  vatId: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
});

export type SubcontractorFormValues = z.infer<typeof schema>;

function toPayload(v: SubcontractorFormValues): Record<string, unknown> {
  const s = (x?: string): string | undefined =>
    x && x.trim() !== '' ? x : undefined;
  const num = (x?: string): number | undefined => {
    if (x == null || x.trim() === '') return undefined;
    const n = Number(x);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    name: v.name,
    contactPerson: s(v.contactPerson),
    email: s(v.email),
    phone: s(v.phone),
    addressLine1: s(v.addressLine1),
    addressLine2: s(v.addressLine2),
    postalCode: s(v.postalCode),
    city: s(v.city),
    country: s(v.country),
    latitude: num(v.latitude),
    longitude: num(v.longitude),
    mapsUrl: s(v.mapsUrl),
    taxNumber: s(v.taxNumber),
    vatId: s(v.vatId),
    iban: s(v.iban),
    bic: s(v.bic),
    bankName: s(v.bankName),
    notes: s(v.notes),
  };
}

export function SubcontractorForm({
  subcontractor,
  submitting,
  onSubmit,
  onCancel,
}: {
  subcontractor?: SubcontractorDetail;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}): ReactNode {
  const f = texts.subcontractors.fields;
  const s = texts.subcontractors.sections;
  const a = texts.subcontractors.actions;
  const { toast } = useToast();
  const [geocoding, setGeocoding] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubcontractorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subcontractor?.name ?? '',
      contactPerson: subcontractor?.contactPerson ?? '',
      email: subcontractor?.email ?? '',
      phone: subcontractor?.phone ?? '',
      addressLine1: subcontractor?.addressLine1 ?? '',
      addressLine2: subcontractor?.addressLine2 ?? '',
      postalCode: subcontractor?.postalCode ?? '',
      city: subcontractor?.city ?? '',
      country: subcontractor?.country ?? '',
      latitude:
        subcontractor?.latitude != null ? String(subcontractor.latitude) : '',
      longitude:
        subcontractor?.longitude != null ? String(subcontractor.longitude) : '',
      mapsUrl: subcontractor?.mapsUrl ?? '',
      taxNumber: subcontractor?.taxNumber ?? '',
      vatId: subcontractor?.vatId ?? '',
      iban: subcontractor?.iban ?? '',
      bic: subcontractor?.bic ?? '',
      bankName: subcontractor?.bankName ?? '',
      notes: subcontractor?.notes ?? '',
    },
  });

  const addressLine1 = watch('addressLine1');
  const postalCode = watch('postalCode');
  const city = watch('city');
  const country = watch('country');
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const mapsUrl = watch('mapsUrl');

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
        toast({ description: texts.subcontractors.toast.geocoded });
      })
      .catch(() =>
        toast({
          variant: 'destructive',
          description: texts.subcontractors.toast.geocodeFailed,
        }),
      )
      .finally(() => setGeocoding(false));
  };

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))}
      className="space-y-8"
    >
      {/* Firmendaten */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.company}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.name} error={errors.name?.message} required>
            <Input {...register('name')} className="min-h-[44px]" />
          </Field>
          <Field label={f.contactPerson}>
            <Input {...register('contactPerson')} className="min-h-[44px]" />
          </Field>
          <Field label={f.email}>
            <Input type="email" {...register('email')} className="min-h-[44px]" />
          </Field>
          <Field label={f.phone}>
            <Input {...register('phone')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Adresse */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.address}
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

      {/* Steuer */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{s.tax}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.taxNumber}>
            <Input {...register('taxNumber')} className="min-h-[44px]" />
          </Field>
          <Field label={f.vatId}>
            <Input {...register('vatId')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Bankverbindung */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{s.bank}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.iban}>
            <Input {...register('iban')} className="min-h-[44px]" />
          </Field>
          <Field label={f.bic}>
            <Input {...register('bic')} className="min-h-[44px]" />
          </Field>
          <Field label={f.bankName}>
            <Input {...register('bankName')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Notizen */}
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
