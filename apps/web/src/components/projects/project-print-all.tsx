'use client';

import { forwardRef, type ReactNode } from 'react';
import type {
  ProjectAssignment,
  ProjectDetail,
  ProjectEmailRecipient,
  ProjectEquipment,
  ProjectSite,
  ProjectStatusHistory,
} from '@/lib/projects';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';
import { CompanyLogoPrint } from '@/components/layout/app-brand';

const t = texts.projects;

function field(label: string, value: string | number | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function address(
  line1: string | null,
  line2: string | null | undefined,
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
 * Druck-Ansicht mit allen Projektdaten (Stammdaten, Standorte, Zuweisungen,
 * Equipment, Verteiler, Statushistorie). Nur beim Drucken sichtbar.
 */
export const ProjectPrintAll = forwardRef<HTMLDivElement, { project: ProjectDetail }>(
  function ProjectPrintAll({ project }, ref) {
    const siteAddr = address(
      project.siteAddressLine1,
      null,
      project.sitePostalCode,
      project.siteCity,
      project.siteCountry,
    );
    const accomAddr = address(
      project.accommodationAddressLine1,
      project.accommodationAddressLine2,
      project.accommodationPostalCode,
      project.accommodationCity,
      project.accommodationCountry,
    );

    return (
      <div ref={ref} className="print-all-content hidden print:space-y-4 print:p-6 text-sm">
        <div className="mb-4 border-b-2 pb-2">
          <CompanyLogoPrint className="mb-3" />
          <h1 className="text-xl font-bold">{project.title}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {project.projectNumber} · {project.customer.companyName}
          </p>
        </div>

        <Section title={t.tabs.stammdaten}>
          {field(t.fields.title, project.title)}
          {field(t.fields.customer, project.customer.companyName)}
          {field(t.fields.branch, project.branch?.name)}
          {field(t.fields.contact, project.primaryCustomerContact
            ? `${project.primaryCustomerContact.firstName} ${project.primaryCustomerContact.lastName}`
            : null)}
          {field(t.fields.projectManager, project.internalProjectManager?.displayName)}
          {field(t.fields.status, t.status[project.status])}
          {field(t.fields.priority, t.priority[project.priority])}
          {field(t.fields.serviceType, t.serviceType[project.serviceType])}
          {field(t.fields.plannedStart, formatDate(project.plannedStartDate))}
          {field(t.fields.plannedEnd, formatDate(project.plannedEndDate))}
          {field(t.fields.actualStart, formatDate(project.actualStartDate))}
          {field(t.fields.actualEnd, formatDate(project.actualEndDate))}
          {field(t.fields.billingMode, project.billingMode ? t.billingMode[project.billingMode] : null)}
          {field(t.fields.siteName, project.siteName)}
          {field(t.fields.siteAddress, siteAddr)}
          {field(t.fields.accessInfo, project.siteAccessInfo)}
          {field(t.fields.workingHours, project.siteWorkingHours)}
          {field(t.fields.accommodationAddress, accomAddr)}
          {field(t.fields.accommodationNotes, project.accommodationNotes)}
          {field(t.fields.notes, project.notes)}
          {field(t.fields.description, project.description)}
        </Section>

        {project.sites.length > 0 && (
          <Section title={t.tabs.standorte}>
            {project.sites.map((s: ProjectSite) => (
              <div key={s.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">{s.name}</p>
                {field(
                  'Adresse',
                  address(s.addressLine1, s.addressLine2, s.postalCode, s.city, s.country),
                )}
                {field(t.fields.accessInfo, s.accessInfo)}
                {field(t.fields.notes, s.notes)}
              </div>
            ))}
          </Section>
        )}

        {project.assignments.length > 0 && (
          <Section title={t.tabs.monteure}>
            {project.assignments.map((a: ProjectAssignment) => (
              <div key={a.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">
                  {a.worker.firstName} {a.worker.lastName}
                  {a.isLead ? ' (Leitung)' : ''}
                  {!a.active ? ' – beendet' : ''}
                </p>
                {field(t.fields.roleName, a.roleName)}
                {field(
                  'Zeitraum',
                  [formatDate(a.startDate), formatDate(a.endDate)].filter(Boolean).join(' – '),
                )}
                {field(t.fields.notes, a.notes)}
              </div>
            ))}
          </Section>
        )}

        {project.equipment.length > 0 && (
          <Section title={t.tabs.equipment}>
            {project.equipment.map((e: ProjectEquipment) => (
              <div key={e.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">
                  {e.name}
                  {e.quantity > 1 ? ` × ${e.quantity}` : ''}
                </p>
                {field(t.fields.serialNumber, e.serialNumber)}
                {field(t.fields.issuedAt, formatDate(e.issuedAt))}
                {field(t.fields.returnedAt, formatDate(e.returnedAt))}
                {field(t.fields.notes, e.notes)}
              </div>
            ))}
          </Section>
        )}

        {project.emailRecipients.length > 0 && (
          <Section title={t.tabs.emailVerteiler}>
            {project.emailRecipients.map((r: ProjectEmailRecipient) => (
              <div key={r.id} className="flex flex-wrap gap-2 text-sm">
                <span>{r.email}</span>
                {r.name && <span className="text-muted-foreground">({r.name})</span>}
                <span className="text-xs text-muted-foreground">{r.recipientType}</span>
              </div>
            ))}
          </Section>
        )}

        {project.statusHistory.length > 0 && (
          <Section title={t.tabs.notizenVerlauf}>
            {project.statusHistory.map((h: ProjectStatusHistory) => (
              <div key={h.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="text-sm">
                  {h.fromStatus ? `${t.status[h.fromStatus as keyof typeof t.status] ?? h.fromStatus} → ` : ''}
                  {t.status[h.toStatus as keyof typeof t.status] ?? h.toStatus}
                  {' · '}
                  {formatDate(h.changedAt)}
                  {h.changedBy ? ` · ${h.changedBy.displayName}` : ''}
                </p>
                {field(t.fields.noteBody, h.comment)}
              </div>
            ))}
          </Section>
        )}

        <div className="mt-4 border-t pt-2 text-[10px] text-muted-foreground">
          Gedruckt am {new Date().toLocaleDateString('de-DE')} · {project.projectNumber}{' '}
          {project.title}
        </div>
      </div>
    );
  },
);
