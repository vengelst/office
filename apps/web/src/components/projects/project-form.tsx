'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import {
  customersApi,
  type CustomerBranch,
  type CustomerContact,
  type CustomerListItem,
} from '@/lib/customers';
import {
  projectsApi,
  type ProjectDetail,
  type ProjectUserOption,
} from '@/lib/projects';
import { texts } from '@/lib/texts';

const NONE = '__none__';

const SERVICE_TYPES = ['VIDEO', 'ELECTRICAL', 'SERVICE', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const BILLING_MODES = ['HOURLY_PACKAGE', 'UNIT_BASED', 'MIXED'] as const;

const schema = z.object({
  title: z.string().min(1, 'Pflichtfeld'),
  description: z.string().optional(),
  customerId: z.string().min(1, 'Pflichtfeld'),
  branchId: z.string().optional(),
  primaryCustomerContactId: z.string().optional(),
  serviceType: z.enum(SERVICE_TYPES),
  priority: z.enum(PRIORITIES),
  internalProjectManagerUserId: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  actualEndDate: z.string().optional(),
  billingMode: z
    .enum(['', 'HOURLY_PACKAGE', 'UNIT_BASED', 'MIXED'])
    .optional(),
  weeklyPackageHours: z.string().optional(),
  weeklyPackagePrice: z.string().optional(),
  overtimeRatePerHour: z.string().optional(),
  pauseRuleId: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof schema>;

/**
 * Wandelt Formularwerte in das API-Payload-Format.
 * Konvertiert Strings zu Zahlen, leere IDs zu null und
 * entfernt Stundenpaket-Felder wenn ein anderer Abrechnungsmodus gewählt ist.
 */
function toPayload(v: ProjectFormValues): Record<string, unknown> {
  const num = (s?: string): number | undefined => {
    if (s == null || s.trim() === '') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const date = (s?: string): string | undefined =>
    s && s.trim() !== '' ? s : undefined;
  const id = (s?: string): string | null | undefined =>
    s && s !== NONE ? s : null;
  const hourly = v.billingMode === 'HOURLY_PACKAGE';
  return {
    title: v.title,
    description: v.description || null,
    customerId: v.customerId,
    branchId: id(v.branchId),
    primaryCustomerContactId: id(v.primaryCustomerContactId),
    serviceType: v.serviceType,
    priority: v.priority,
    internalProjectManagerUserId: id(v.internalProjectManagerUserId),
    plannedStartDate: date(v.plannedStartDate),
    plannedEndDate: date(v.plannedEndDate),
    actualStartDate: date(v.actualStartDate),
    actualEndDate: date(v.actualEndDate),
    billingMode: v.billingMode ? v.billingMode : null,
    weeklyPackageHours: hourly ? num(v.weeklyPackageHours) : null,
    weeklyPackagePrice: hourly ? num(v.weeklyPackagePrice) : null,
    overtimeRatePerHour: hourly ? num(v.overtimeRatePerHour) : null,
    pauseRuleId: id(v.pauseRuleId),
  };
}

const isoDate = (v?: string | null): string =>
  v ? v.slice(0, 10) : '';

/**
 * Formular für die Stammdaten eines Projekts.
 * Enthält Sektionen für Allgemein (Kunde, Niederlassung, Ansprechpartner, Leistungsart),
 * Zeitplanung (Plan-/Ist-Termine), Abrechnung (Stundenpaket-Konditionen) und Pausenregelung.
 * Lädt Kunden, Niederlassungen, Kontakte und Benutzer dynamisch nach.
 *
 * @param project - Das zu bearbeitende Projekt
 * @param submitting - Ob gerade gespeichert wird
 * @param onSubmit - Callback mit dem API-Payload beim Absenden
 */
export function ProjectForm({
  project,
  submitting,
  onSubmit,
}: {
  project: ProjectDetail;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}): ReactNode {
  const f = texts.projects.fields;
  const s = texts.projects.sections;
  const a = texts.projects.actions;

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [users, setUsers] = useState<ProjectUserOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project.title,
      description: project.description ?? '',
      customerId: project.customerId,
      branchId: project.branchId ?? NONE,
      primaryCustomerContactId: project.primaryCustomerContactId ?? NONE,
      serviceType: project.serviceType,
      priority: project.priority,
      internalProjectManagerUserId:
        project.internalProjectManagerUserId ?? NONE,
      plannedStartDate: isoDate(project.plannedStartDate),
      plannedEndDate: isoDate(project.plannedEndDate),
      actualStartDate: isoDate(project.actualStartDate),
      actualEndDate: isoDate(project.actualEndDate),
      billingMode: project.billingMode ?? '',
      weeklyPackageHours:
        project.weeklyPackageHours != null
          ? String(project.weeklyPackageHours)
          : '',
      weeklyPackagePrice:
        project.weeklyPackagePrice != null
          ? String(project.weeklyPackagePrice)
          : '',
      overtimeRatePerHour:
        project.overtimeRatePerHour != null
          ? String(project.overtimeRatePerHour)
          : '',
      pauseRuleId: project.pauseRuleId ?? '',
    },
  });

  const customerId = watch('customerId');
  const branchId = watch('branchId');
  const contactId = watch('primaryCustomerContactId');
  const managerId = watch('internalProjectManagerUserId');
  const serviceType = watch('serviceType');
  const priority = watch('priority');
  const billingMode = watch('billingMode');

  // Stammdaten für Dropdowns laden
  useEffect(() => {
    customersApi
      .list({ limit: 500, sortBy: 'companyName', sortDir: 'asc' })
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));
    projectsApi
      .listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  // Niederlassungen & Ansprechpartner des gewählten Kunden laden
  useEffect(() => {
    if (!customerId) {
      setBranches([]);
      setContacts([]);
      return;
    }
    customersApi
      .get(customerId)
      .then((c) => {
        setBranches(c.branches);
        setContacts(c.contacts);
      })
      .catch(() => {
        setBranches([]);
        setContacts([]);
      });
  }, [customerId]);

  const filteredContacts =
    branchId && branchId !== NONE
      ? contacts.filter((c) => c.branchId === branchId || c.branchId == null)
      : contacts;

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))}
      className="space-y-8"
    >
      {/* Allgemein */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{s.base}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.projectNumber}>
            <Input
              value={project.projectNumber}
              readOnly
              className="min-h-[44px] bg-muted font-mono"
            />
          </Field>
          <Field label={f.status}>
            <div className="flex min-h-[44px] items-center gap-2">
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={priority} />
            </div>
          </Field>
          <Field
            label={f.title}
            error={errors.title?.message}
            required
            className="md:col-span-2"
          >
            <Input {...register('title')} className="min-h-[44px]" />
          </Field>
          <Field label={f.description} className="md:col-span-2">
            <Textarea {...register('description')} rows={3} />
          </Field>
          <Field
            label={f.customer}
            error={errors.customerId?.message}
            required
          >
            <Select
              value={customerId}
              onValueChange={(val) => {
                setValue('customerId', val);
                setValue('branchId', NONE);
                setValue('primaryCustomerContactId', NONE);
              }}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.branch}>
            <Select
              value={branchId || NONE}
              onValueChange={(val) => setValue('branchId', val)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.contact}>
            <Select
              value={contactId || NONE}
              onValueChange={(val) =>
                setValue('primaryCustomerContactId', val)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {filteredContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.serviceType}>
            <Select
              value={serviceType}
              onValueChange={(val) =>
                setValue('serviceType', val as ProjectFormValues['serviceType'])
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {texts.projects.serviceType[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.priority}>
            <Select
              value={priority}
              onValueChange={(val) =>
                setValue('priority', val as ProjectFormValues['priority'])
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {texts.projects.priority[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={f.projectManager}>
            <Select
              value={managerId || NONE}
              onValueChange={(val) =>
                setValue('internalProjectManagerUserId', val)
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {/* Zeitplan */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.planning}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.plannedStart}>
            <Input
              type="date"
              {...register('plannedStartDate')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.plannedEnd}>
            <Input
              type="date"
              {...register('plannedEndDate')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.actualStart}>
            <Input
              type="date"
              {...register('actualStartDate')}
              className="min-h-[44px]"
            />
          </Field>
          <Field label={f.actualEnd}>
            <Input
              type="date"
              {...register('actualEndDate')}
              className="min-h-[44px]"
            />
          </Field>
        </div>
      </section>

      {/* Abrechnung */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {s.billing}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.billingMode}>
            <Select
              value={billingMode || NONE}
              onValueChange={(val) =>
                setValue(
                  'billingMode',
                  (val === NONE ? '' : val) as ProjectFormValues['billingMode'],
                )
              }
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="–" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {BILLING_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {texts.projects.billingMode[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {billingMode === 'HOURLY_PACKAGE' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={f.weeklyPackageHours}>
              <Input
                type="number"
                inputMode="decimal"
                {...register('weeklyPackageHours')}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.weeklyPackagePrice}>
              <Input
                type="number"
                inputMode="decimal"
                {...register('weeklyPackagePrice')}
                className="min-h-[44px]"
              />
            </Field>
            <Field label={f.overtimeRate}>
              <Input
                type="number"
                inputMode="decimal"
                {...register('overtimeRatePerHour')}
                className="min-h-[44px]"
              />
            </Field>
          </div>
        )}
      </section>

      {/* Pausenregelung */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {f.pauseRule}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={f.pauseRule}>
            <Input {...register('pauseRuleId')} className="min-h-[44px]" />
          </Field>
        </div>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} className="min-h-[44px]">
          {submitting ? a.saving : a.save}
        </Button>
      </div>
    </form>
  );
}
