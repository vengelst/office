'use client';

import { forwardRef, type ReactNode } from 'react';
import type {
  WorkerAssignment,
  WorkerCertification,
  WorkerDetail,
  WorkerEquipmentIssue,
  WorkerLanguage,
} from '@/lib/workers';
import { workerFullName } from '@/lib/workers';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';

const t = texts.workers;

function field(label: string, value: string | number | boolean | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : value;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
      <span>{display}</span>
    </div>
  );
}

function address(
  line1: string | null,
  line2: string | null,
  postalCode: string | null,
  city: string | null,
  country: string | null,
): string | null {
  const parts = [line1, line2, [postalCode, city].filter(Boolean).join(' '), country].filter(
    Boolean,
  );
  return parts.length ? parts.join(', ') : null;
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="mb-4 break-inside-avoid">
      <h3 className="mb-1 border-b pb-1 text-sm font-semibold uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-1 pt-1">{children}</div>
    </div>
  );
}

/**
 * Druck-Ansicht mit allen Monteurdaten inkl. Qualifikationen, Vertrag,
 * Equipment und Projektzuweisungen. Nur beim Drucken sichtbar.
 */
export const WorkerPrintAll = forwardRef<HTMLDivElement, { worker: WorkerDetail }>(
  function WorkerPrintAll({ worker }, ref) {
    const name = workerFullName(worker);
    const addr = address(
      worker.addressLine1,
      worker.addressLine2,
      worker.postalCode,
      worker.city,
      worker.country,
    );

    return (
      <div ref={ref} className="print-all-content hidden print:space-y-4 print:p-6 text-sm">
        <div className="mb-4 border-b-2 pb-2">
          <h1 className="text-xl font-bold">{name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{worker.workerNumber}</p>
        </div>

        <Section title={t.tabs.master}>
          {field(t.fields.firstName, worker.firstName)}
          {field(t.fields.lastName, worker.lastName)}
          {field(t.fields.workerNumber, worker.workerNumber)}
          {field(t.fields.type, t.type[worker.workerType])}
          {field(t.fields.availability, t.availability[worker.availability])}
          {field('Aktiv', worker.active)}
          {field(t.fields.email, worker.email)}
          {field(t.fields.phone, worker.phone)}
          {field(t.fields.phoneSecondary, worker.phoneSecondary)}
          {field('Adresse', addr)}
          {field(t.fields.nationality, worker.nationality)}
          {field(t.fields.dateOfBirth, formatDate(worker.dateOfBirth))}
          {field(t.fields.placeOfBirth, worker.placeOfBirth)}
          {field(t.fields.emergencyContactName, worker.emergencyContactName)}
          {field(t.fields.emergencyContactPhone, worker.emergencyContactPhone)}
          {field(t.fields.emergencyContactRelation, worker.emergencyContactRelation)}
          {field(t.fields.hasDriversLicense, worker.hasDriversLicense)}
          {field(t.fields.shoeSize, worker.shoeSize)}
          {field(t.fields.clothingSize, worker.clothingSize)}
          {field(t.fields.notes, worker.notes)}
        </Section>

        <Section title={t.tabs.documents}>
          {field(t.fields.idNumber, worker.idNumber)}
          {field(t.fields.taxNumber, worker.taxNumber)}
          {field(t.fields.socialSecurityNumber, worker.socialSecurityNumber)}
          {field(t.fields.oib, worker.oib)}
          {field(t.fields.passportNumber, worker.passportNumber)}
          {field(t.fields.passportExpiry, formatDate(worker.passportExpiry))}
          {field(t.fields.residencePermitNumber, worker.residencePermitNumber)}
          {field(t.fields.residencePermitExpiry, formatDate(worker.residencePermitExpiry))}
          {field(t.fields.workPermitNumber, worker.workPermitNumber)}
          {field(t.fields.workPermitExpiry, formatDate(worker.workPermitExpiry))}
        </Section>

        {(worker.languages.length > 0 || worker.certifications.length > 0) && (
          <Section title={t.tabs.qualifications}>
            {worker.languages.map((l: WorkerLanguage) => (
              <div key={l.id} className="text-sm">
                {l.language}
                {l.proficiency
                  ? ` (${t.proficiency[l.proficiency] ?? l.proficiency})`
                  : ''}
              </div>
            ))}
            {worker.certifications.map((c: WorkerCertification) => (
              <div key={c.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">{c.name}</p>
                {field(t.fields.issuedBy, c.issuedBy)}
                {field(t.fields.issuedDate, formatDate(c.issuedDate))}
                {field(t.fields.expiryDate, formatDate(c.expiryDate))}
              </div>
            ))}
          </Section>
        )}

        <Section title={t.tabs.contract}>
          {field(t.fields.subcontractor, worker.subcontractor?.name)}
          {field(t.fields.contractStart, formatDate(worker.contractStart))}
          {field(t.fields.contractEnd, formatDate(worker.contractEnd))}
          {field(t.fields.hourlyRate, worker.hourlyRate)}
          {field(t.fields.dailyRate, worker.dailyRate)}
        </Section>

        {(worker.equipmentIssues?.length ?? 0) > 0 && (
          <Section title={t.tabs.equipment}>
            {worker.equipmentIssues!.map((e: WorkerEquipmentIssue) => (
              <div key={e.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">
                  {e.equipmentItem?.name ?? e.equipmentItemId}
                </p>
                {field(t.fields.issuedAt, formatDate(e.issuedAt))}
                {field(t.fields.returnedAt, formatDate(e.returnedAt))}
                {field(t.fields.condition, e.conditionOut)}
              </div>
            ))}
          </Section>
        )}

        {worker.assignments.length > 0 && (
          <Section title={t.tabs.projects}>
            {worker.assignments.map((a: WorkerAssignment) => (
              <div key={a.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">
                  {a.project.title}
                  {a.isLead ? ' (Leitung)' : ''}
                  {!a.active ? ' – beendet' : ''}
                </p>
                {field(t.fields.role, a.roleName)}
                {field(
                  t.fields.period,
                  [formatDate(a.startDate), formatDate(a.endDate)].filter(Boolean).join(' – '),
                )}
              </div>
            ))}
          </Section>
        )}
        <div className="mt-4 border-t pt-2 text-[10px] text-muted-foreground">
          Gedruckt am {new Date().toLocaleDateString('de-DE')} · {worker.workerNumber} {name}
        </div>
      </div>
    );
  },
);
