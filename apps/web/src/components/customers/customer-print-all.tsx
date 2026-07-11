'use client';

import { forwardRef, type ReactNode } from 'react';
import type {
  CustomerDetail,
  CustomerBranch,
  CustomerContact,
  CustomerEmail,
  CustomerBankAccount,
} from '@/lib/customers';
import { texts } from '@/lib/texts';

const t = texts.customers;

function field(label: string, value: string | number | null | undefined): ReactNode {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
      <span>{value}</span>
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
  const parts = [line1, line2, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean);
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

export const CustomerPrintAll = forwardRef<HTMLDivElement, { customer: CustomerDetail }>(
  function CustomerPrintAll({ customer }, ref) {
    const addr = address(
      customer.addressLine1,
      customer.addressLine2,
      customer.postalCode,
      customer.city,
      customer.country,
    );

    return (
      <div ref={ref} className="print-all-content hidden print:space-y-4 print:p-6 text-sm">
        <div className="mb-4 border-b-2 pb-2">
          <h1 className="text-xl font-bold">{customer.companyName}</h1>
          <p className="font-mono text-xs text-muted-foreground">{customer.customerNumber}</p>
        </div>

        <Section title={t.tabs.master}>
          {field(t.fields.companyName, customer.companyName)}
          {field(t.fields.legalForm, customer.legalForm)}
          {field(t.fields.industry, customer.industry)}
          {field(t.fields.phone, customer.phone)}
          {field(t.fields.website, customer.website)}
          {field(t.fields.vatId, customer.vatId)}
          {field(t.fields.taxNumber, customer.taxNumber)}
          {field(t.fields.paymentTermDays, customer.paymentTermDays)}
          {field('Adresse', addr)}
          {field(t.fields.notes, customer.notes)}
        </Section>

        {customer.emails.length > 0 && (
          <Section title={t.tabs.emails}>
            {customer.emails.map((e: CustomerEmail) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span>{e.email}</span>
                <span className="text-xs text-muted-foreground">
                  ({e.label || e.emailType})
                </span>
                {e.isPrimary && (
                  <span className="rounded bg-gray-200 px-1 text-[10px]">Primär</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {customer.bankAccounts.length > 0 && (
          <Section title={t.tabs.bankAccounts}>
            {customer.bankAccounts.map((b: CustomerBankAccount) => (
              <div key={b.id} className="space-y-0.5 border-l-2 pl-2">
                {field('Bank', b.bankName)}
                {field('IBAN', b.iban)}
                {field('BIC', b.bic)}
                {field('Kontoinhaber', b.accountHolder)}
              </div>
            ))}
          </Section>
        )}

        {customer.branches.length > 0 && (
          <Section title={t.tabs.branches}>
            {customer.branches.map((br: CustomerBranch) => (
              <div key={br.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">{br.name}</p>
                {field('Adresse', address(br.addressLine1, br.addressLine2, br.postalCode, br.city, br.country))}
                {field('Telefon', br.phone)}
                {field('E-Mail', br.email)}
                {field('Notizen', br.notes)}
              </div>
            ))}
          </Section>
        )}

        {customer.contacts.length > 0 && (
          <Section title={t.tabs.contacts}>
            {customer.contacts.map((c: CustomerContact) => (
              <div key={c.id} className="space-y-0.5 border-l-2 pl-2">
                <p className="font-medium">
                  {[c.title, c.firstName, c.lastName].filter(Boolean).join(' ')}
                </p>
                {field('Position', c.role)}
                {field('Abteilung', c.department)}
                {field('E-Mail', c.email)}
                {field('Mobil', c.phoneMobile)}
                {field('Festnetz', c.phoneLandline)}
                {field(
                  'Adresse',
                  address(c.addressLine1, c.addressLine2, c.postalCode, c.city, c.country),
                )}
              </div>
            ))}
          </Section>
        )}

        <div className="mt-4 border-t pt-2 text-[10px] text-muted-foreground">
          Gedruckt am {new Date().toLocaleDateString('de-DE')} · {customer.companyName}
        </div>
      </div>
    );
  },
);
