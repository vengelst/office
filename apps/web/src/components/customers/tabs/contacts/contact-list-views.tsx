/**
 * Darstellung eines Ansprechpartners: Karte (kompakt) oder Tabellenzeile.
 * Visitenkarte rechts neben den Kontaktdaten (E-Mail/Telefon).
 */

'use client';

import {
  CreditCard,
  Gift,
  Linkedin,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MailLink, PhoneLink } from '@/components/customers/contact-links';
import type { CustomerContact } from '@/lib/customers';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';
import { AuthImage } from './contacts-helpers';

export type ContactsViewMode = 'table' | '2' | '3' | '4';

export const CONTACTS_VIEW_KEY = 'office_contacts_view';

export function contactDisplayName(c: CustomerContact): string {
  return [c.title, c.firstName, c.lastName].filter(Boolean).join(' ');
}

export function ContactCardItem({
  contact: c,
  cardSrc,
  compact,
  uploadBusy,
  onEdit,
  onDelete,
  onUpload,
  onLightbox,
}: {
  contact: CustomerContact;
  cardSrc?: string;
  compact?: boolean;
  uploadBusy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: () => void;
  onLightbox: (url: string) => void;
}): React.ReactNode {
  const t = texts.customers;
  const pad = compact ? 'p-3' : 'p-4';
  const thumb = compact ? 'h-14 w-24' : 'h-20 w-32';

  return (
    <Card>
      <CardContent className={`space-y-2 ${pad}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`font-medium leading-tight ${compact ? 'text-sm' : ''}`}>
              {contactDisplayName(c)}
            </p>
            {(c.role || c.department) && (
              <p className="truncate text-xs text-muted-foreground">
                {[c.role, c.department].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onEdit}
              aria-label={t.actions.edit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive"
              onClick={onDelete}
              aria-label={t.actions.delete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Kontaktdaten links, Visitenkarte rechts – kein Leerraum darunter */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className={`flex flex-col gap-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {c.email && <MailLink email={c.email} />}
              {c.phoneMobile && <PhoneLink phone={c.phoneMobile} mobile />}
              {c.phoneLandline && <PhoneLink phone={c.phoneLandline} />}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {c.birthday && (
                <span className="inline-flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {formatDate(c.birthday)}
                </span>
              )}
              {c.linkedInUrl && (
                <a
                  href={c.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {c.isAccountingContact && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {t.fields.isAccountingContact}
                </Badge>
              )}
              {c.isProjectContact && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {t.fields.isProjectContact}
                </Badge>
              )}
              {c.isSignatory && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {t.fields.isSignatory}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={uploadBusy}
              onClick={onUpload}
            >
              <CreditCard className="h-3.5 w-3.5" />
              {t.actions.uploadBusinessCard}
            </Button>
          </div>

          {cardSrc ? (
            <AuthImage
              src={cardSrc}
              alt={`Visitenkarte ${c.firstName} ${c.lastName}`}
              className={`${thumb} shrink-0 cursor-pointer rounded border object-cover transition-opacity hover:opacity-90`}
              onClick={onLightbox}
            />
          ) : (
            <div
              className={`${thumb} shrink-0 rounded border border-dashed border-muted-foreground/30 bg-muted/20`}
              aria-hidden
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContactsTable({
  contacts,
  cardImages,
  branchLabel,
  uploadFor,
  onEdit,
  onDelete,
  onUpload,
  onLightbox,
}: {
  contacts: CustomerContact[];
  cardImages: Record<string, string>;
  branchLabel: (branchId: string | null) => string;
  uploadFor: string | null;
  onEdit: (c: CustomerContact) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string) => void;
  onLightbox: (url: string) => void;
}): React.ReactNode {
  const t = texts.customers;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">{t.fields.role}</th>
            <th className="px-3 py-2 font-medium">{t.fields.email}</th>
            <th className="px-3 py-2 font-medium">{t.fields.phoneMobile}</th>
            <th className="px-3 py-2 font-medium">{t.fields.branch}</th>
            <th className="px-3 py-2 font-medium w-24">Karte</th>
            <th className="px-3 py-2 font-medium w-28" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                {contactDisplayName(c)}
              </td>
              <td className="px-3 py-2 text-muted-foreground max-w-[10rem] truncate">
                {[c.role, c.department].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="px-3 py-2">
                {c.email ? <MailLink email={c.email} /> : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {c.phoneMobile ? (
                  <PhoneLink phone={c.phoneMobile} mobile />
                ) : c.phoneLandline ? (
                  <PhoneLink phone={c.phoneLandline} />
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                {branchLabel(c.branchId)}
              </td>
              <td className="px-3 py-2">
                {cardImages[c.id] ? (
                  <AuthImage
                    src={cardImages[c.id]}
                    alt=""
                    className="h-10 w-16 cursor-pointer rounded border object-cover"
                    onClick={onLightbox}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(c)}
                    aria-label={t.actions.edit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpload(c.id)}
                    disabled={uploadFor === c.id}
                    aria-label={t.actions.uploadBusinessCard}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDelete(c.id)}
                    aria-label={t.actions.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function gridClassForView(mode: ContactsViewMode): string {
  switch (mode) {
    case '2':
      return 'grid grid-cols-1 gap-3 sm:grid-cols-2';
    case '3':
      return 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
    case '4':
      return 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    default:
      return 'grid grid-cols-1 gap-3';
  }
}
