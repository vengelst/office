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
import {
  VEHICLE_CATEGORIES,
  VEHICLE_FUEL_TYPES,
  VEHICLE_OWNER_TYPES,
  type VehicleCategory,
  type VehicleDetail,
  type VehicleFuelType,
  type VehicleOwnerType,
} from '@/lib/vehicles';
import { texts } from '@/lib/texts';

const schema = z.object({
  licensePlate: z.string().min(1, 'Pflichtfeld'),
  make: z.string().optional(),
  model: z.string().optional(),
  internalName: z.string().optional(),
  category: z.string().optional(),
  year: z.string().optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  vin: z.string().optional(),
  ownerType: z.enum(['OWN', 'SUBCONTRACTOR']),
  subcontractorId: z.string().optional(),
  nextInspection: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  notes: z.string().optional(),
});

export type VehicleFormValues = z.infer<typeof schema>;

const NONE = '__none__';

function toPayload(v: VehicleFormValues): Record<string, unknown> {
  const s = (x?: string): string | undefined =>
    x && x.trim() !== '' ? x : undefined;
  const num = (x?: string): number | undefined => {
    if (x == null || x.trim() === '') return undefined;
    const n = Number(x);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  };
  const isSub = v.ownerType === 'SUBCONTRACTOR';
  return {
    licensePlate: v.licensePlate.trim(),
    make: s(v.make),
    model: s(v.model),
    internalName: s(v.internalName),
    category: s(v.category),
    year: num(v.year),
    color: s(v.color),
    fuelType: s(v.fuelType),
    vin: s(v.vin),
    ownerType: v.ownerType,
    subcontractorId: isSub ? s(v.subcontractorId) ?? null : null,
    nextInspection: s(v.nextInspection) ?? null,
    insuranceExpiry: s(v.insuranceExpiry) ?? null,
    notes: s(v.notes),
  };
}

export function VehicleForm({
  vehicle,
  subcontractors,
  submitting,
  onSubmit,
  onCancel,
}: {
  vehicle?: VehicleDetail;
  subcontractors: { id: string; name: string }[];
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}): ReactNode {
  const f = texts.vehicles.fields;
  const s = texts.vehicles.sections;
  const a = texts.vehicles.actions;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      licensePlate: vehicle?.licensePlate ?? '',
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      internalName: vehicle?.internalName ?? '',
      category: vehicle?.category ?? '',
      year: vehicle?.year != null ? String(vehicle.year) : '',
      color: vehicle?.color ?? '',
      fuelType: vehicle?.fuelType ?? '',
      vin: vehicle?.vin ?? '',
      ownerType: vehicle?.ownerType ?? 'OWN',
      subcontractorId: vehicle?.subcontractorId ?? '',
      nextInspection: vehicle?.nextInspection
        ? vehicle.nextInspection.slice(0, 10)
        : '',
      insuranceExpiry: vehicle?.insuranceExpiry
        ? vehicle.insuranceExpiry.slice(0, 10)
        : '',
      notes: vehicle?.notes ?? '',
    },
  });

  const category = watch('category');
  const fuelType = watch('fuelType');
  const ownerType = watch('ownerType');
  const subcontractorId = watch('subcontractorId');

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))}
      className="space-y-8"
    >
      {/* Fahrzeug */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.vehicle}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label={f.licensePlate}
            error={errors.licensePlate?.message}
            required
          >
            <Input {...register('licensePlate')} className="min-h-[44px]" />
          </Field>
          <Field label={f.internalName}>
            <Input {...register('internalName')} className="min-h-[44px]" />
          </Field>
          <Field label={f.make}>
            <Input {...register('make')} className="min-h-[44px]" />
          </Field>
          <Field label={f.model}>
            <Input {...register('model')} className="min-h-[44px]" />
          </Field>
          <Field label={f.category}>
            <Select
              value={category || NONE}
              onValueChange={(val) =>
                setValue('category', val === NONE ? '' : (val as VehicleCategory))
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {VEHICLE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {texts.vehicles.category[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.fuelType}>
            <Select
              value={fuelType || NONE}
              onValueChange={(val) =>
                setValue('fuelType', val === NONE ? '' : (val as VehicleFuelType))
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {VEHICLE_FUEL_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {texts.vehicles.fuelType[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.year}>
            <Input
              type="number"
              inputMode="numeric"
              {...register('year')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.color}>
            <Input {...register('color')} className="min-h-[44px]" />
          </Field>
          <Field label={f.vin} className="md:col-span-2">
            <Input {...register('vin')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      {/* Eigentümer */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.owner}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.ownerType}>
            <Select
              value={ownerType}
              onValueChange={(val) =>
                setValue('ownerType', val as VehicleOwnerType)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_OWNER_TYPES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {texts.vehicles.ownerType[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {ownerType === 'SUBCONTRACTOR' && (
            <Field label={f.subcontractor}>
              <Select
                value={subcontractorId || NONE}
                onValueChange={(val) =>
                  setValue('subcontractorId', val === NONE ? '' : val)
                }
              >
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>–</SelectItem>
                  {subcontractors.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      </section>

      {/* Dokumente & Fristen */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.documents}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.nextInspection}>
            <Input
              type="date"
              {...register('nextInspection')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.insuranceExpiry}>
            <Input
              type="date"
              {...register('insuranceExpiry')}
              className="min-h-[44px]"
            />
          </Field>
        </div>
      </section>

      {/* Notizen */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.notes}
        </h3>
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
