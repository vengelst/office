'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import { RouteButton } from '@/components/customers/contact-links';
import type { WorkerAvailability, WorkerDetail } from '@/lib/workers';
import { texts } from '@/lib/texts';

const AVAILABILITIES: WorkerAvailability[] = [
  'AVAILABLE',
  'ON_PROJECT',
  'SICK',
  'VACATION',
  'UNAVAILABLE',
];

const schema = z.object({
  firstName: z.string().min(1, 'Pflichtfeld'),
  lastName: z.string().min(1, 'Pflichtfeld'),
  availability: z.enum([
    'AVAILABLE',
    'ON_PROJECT',
    'SICK',
    'VACATION',
    'UNAVAILABLE',
  ]),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  phoneSecondary: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  shoeSize: z.string().optional(),
  clothingSize: z.string().optional(),
  hasDriversLicense: z.boolean().optional(),
  notes: z.string().optional(),
});

export type WorkerMasterFormValues = z.infer<typeof schema>;

function toPayload(v: WorkerMasterFormValues): Record<string, unknown> {
  const s = (x?: string): string | undefined =>
    x && x.trim() !== '' ? x : undefined;
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    availability: v.availability,
    dateOfBirth: s(v.dateOfBirth),
    placeOfBirth: s(v.placeOfBirth),
    nationality: s(v.nationality),
    email: s(v.email),
    phone: s(v.phone),
    phoneSecondary: s(v.phoneSecondary),
    addressLine1: s(v.addressLine1),
    addressLine2: s(v.addressLine2),
    postalCode: s(v.postalCode),
    city: s(v.city),
    country: s(v.country),
    emergencyContactName: s(v.emergencyContactName),
    emergencyContactPhone: s(v.emergencyContactPhone),
    emergencyContactRelation: s(v.emergencyContactRelation),
    shoeSize: s(v.shoeSize),
    clothingSize: s(v.clothingSize),
    hasDriversLicense: v.hasDriversLicense ?? false,
    notes: s(v.notes),
  };
}

interface WorkerMasterFormProps {
  worker?: WorkerDetail;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

export function WorkerMasterForm({
  worker,
  submitting,
  onSubmit,
  onCancel,
}: WorkerMasterFormProps): ReactNode {
  const f = texts.workers.fields;
  const s = texts.workers.sections;
  const a = texts.workers.actions;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WorkerMasterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: worker?.firstName ?? '',
      lastName: worker?.lastName ?? '',
      availability: worker?.availability ?? 'AVAILABLE',
      dateOfBirth: worker?.dateOfBirth ? worker.dateOfBirth.slice(0, 10) : '',
      placeOfBirth: worker?.placeOfBirth ?? '',
      nationality: worker?.nationality ?? '',
      email: worker?.email ?? '',
      phone: worker?.phone ?? '',
      phoneSecondary: worker?.phoneSecondary ?? '',
      addressLine1: worker?.addressLine1 ?? '',
      addressLine2: worker?.addressLine2 ?? '',
      postalCode: worker?.postalCode ?? '',
      city: worker?.city ?? '',
      country: worker?.country ?? '',
      emergencyContactName: worker?.emergencyContactName ?? '',
      emergencyContactPhone: worker?.emergencyContactPhone ?? '',
      emergencyContactRelation: worker?.emergencyContactRelation ?? '',
      shoeSize: worker?.shoeSize ?? '',
      clothingSize: worker?.clothingSize ?? '',
      hasDriversLicense: worker?.hasDriversLicense ?? false,
      notes: worker?.notes ?? '',
    },
  });

  const availability = watch('availability');
  const hasDriversLicense = watch('hasDriversLicense');
  const addressLine1 = watch('addressLine1');
  const postalCode = watch('postalCode');
  const city = watch('city');
  const country = watch('country');

  const fullAddress = [
    addressLine1,
    [postalCode, city].filter(Boolean).join(' '),
    country,
  ]
    .filter((p) => p && p.trim())
    .join(', ');

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))}
      className="space-y-8"
    >
      {/* Persönlich */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.personal}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.firstName} error={errors.firstName?.message} required>
            <Input {...register('firstName')} className="min-h-[44px]" />
          </Field>
          <Field label={f.lastName} error={errors.lastName?.message} required>
            <Input {...register('lastName')} className="min-h-[44px]" />
          </Field>
          {worker && (
            <Field label={f.workerNumber}>
              <Input
                value={worker.workerNumber}
                readOnly
                className="min-h-[44px] bg-muted font-mono"
              />
            </Field>
          )}
          <Field label={f.availability}>
            <Select
              value={availability}
              onValueChange={(val) =>
                setValue('availability', val as WorkerAvailability)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITIES.map((av) => (
                  <SelectItem key={av} value={av}>
                    {texts.workers.availability[av]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.dateOfBirth}>
            <Input
              type="date"
              {...register('dateOfBirth')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.placeOfBirth}>
            <Input {...register('placeOfBirth')} className="min-h-[44px]" />
          </Field>
          <Field label={f.nationality}>
            <Input {...register('nationality')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Kontakt */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.contact}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.email}>
            <Input type="email" {...register('email')} className="min-h-[44px]" />
          </Field>
          <Field label={f.phone}>
            <Input {...register('phone')} className="min-h-[44px]" />
          </Field>
          <Field label={f.phoneSecondary}>
            <Input {...register('phoneSecondary')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Adresse */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {s.address}
          </h3>
          {fullAddress && (
            <RouteButton address={fullAddress} />
          )}
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
      </section>

      {/* Notfallkontakt */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.emergency}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.emergencyContactName}>
            <Input
              {...register('emergencyContactName')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.emergencyContactPhone}>
            <Input
              {...register('emergencyContactPhone')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.emergencyContactRelation}>
            <Input
              {...register('emergencyContactRelation')}
              className="min-h-[44px]"
            />
          </Field>
        </div>
      </section>

      {/* PSA-Größen */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{s.psa}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.shoeSize}>
            <Input {...register('shoeSize')} className="min-h-[44px]" />
          </Field>
          <Field label={f.clothingSize}>
            <Input {...register('clothingSize')} className="min-h-[44px]" />
          </Field>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasDriversLicense ?? false}
              onChange={(e) => setValue('hasDriversLicense', e.target.checked)}
              className="h-4 w-4"
            />
            {f.hasDriversLicense}
          </label>
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
