'use client';

import { forwardRef, type ReactNode } from 'react';
import type { SubcontractorContact, SubcontractorDetail, SubcontractorWorker } from '@/lib/workers';
import { workerFullName } from '@/lib/workers';
import { texts } from '@/lib/texts';

const t = texts.subcontractors;

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
 * Druck-Ansicht mit Stammdaten, Kontakten und zugeordneten Monteuren.
 * Nur beim Drucken sichtbar.
 */
export const SubcontractorPrintAll = forwardRef<
  HTMLDivElement,
  { subcontractor: SubcontractorDetail }
>(function SubcontractorPrintAll({ subcontractor: sub }, ref) {
  const addr = address(
    sub.addressLine1,
    sub.addressLine2,
    sub.postalCode,
    sub.city,
    sub.country,
  );

  return (
    <div ref={ref} className="print-all-content hidden print:space-y-4 print:p-6 text-sm">
      <div className="mb-4 border-b-2 pb-2">
        <h1 className="text-xl font-bold">{sub.name}</h1>
        <p className="text-xs text-muted-foreground">
          {sub.subcontractorType === 'SUPPLIER' ? 'Lieferant' : 'Subunternehmen'}
        </p>
      </div>

      <Section title="Stammdaten">
        {field(t.fields.name, sub.name)}
        {field(t.fields.contactPerson, sub.contactPerson)}
        {field(t.fields.email, sub.email)}
        {field(t.fields.phone, sub.phone)}
        {field('Adresse', addr)}
        {field(t.fields.taxNumber, sub.taxNumber)}
        {field(t.fields.vatId, sub.vatId)}
        {field(t.fields.iban, sub.iban)}
        {field(t.fields.bic, sub.bic)}
        {field(t.fields.bankName, sub.bankName)}
        {field(t.fields.active, sub.active)}
        {field(t.fields.notes, sub.notes)}
      </Section>

      {(sub.contacts?.length ?? 0) > 0 && (
        <Section title="Ansprechpartner">
          {sub.contacts!.map((c: SubcontractorContact) => (
            <div key={c.id} className="space-y-0.5 border-l-2 pl-2">
              <p className="font-medium">
                {[c.title, c.firstName, c.lastName].filter(Boolean).join(' ')}
                {c.isPrimary ? ' (Hauptkontakt)' : ''}
              </p>
              {field(t.fields.contactRole, c.role)}
              {field(t.fields.contactEmail, c.email)}
              {field(t.fields.contactPhoneMobile, c.phoneMobile)}
              {field(t.fields.contactPhoneLandline, c.phoneLandline)}
              {field(t.fields.contactNotes, c.notes)}
            </div>
          ))}
        </Section>
      )}

      {sub.workers.length > 0 && (
        <Section title={t.sections.workers}>
          {sub.workers.map((w: SubcontractorWorker) => (
            <div key={w.id} className="flex gap-2 text-sm border-l-2 pl-2">
              <span className="font-medium">{workerFullName(w)}</span>
              <span className="font-mono text-xs text-muted-foreground">{w.workerNumber}</span>
              <span className="text-xs text-muted-foreground">
                {texts.workers.availability[w.availability]}
              </span>
            </div>
          ))}
        </Section>
      )}

      <div className="mt-4 border-t pt-2 text-[10px] text-muted-foreground">
        Gedruckt am {new Date().toLocaleDateString('de-DE')} · {sub.name}
      </div>
    </div>
  );
});
