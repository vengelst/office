'use client';

import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  ResearchResult,
  ResearchContact,
} from '@/lib/research';
import { texts } from '@/lib/texts';

/** Mapping von Firmenfeld-Keys auf Labels. */
const COMPANY_FIELD_LABELS: Record<string, string> = {
  companyName: texts.customers.fields.companyName,
  legalForm: texts.customers.fields.legalForm,
  industry: texts.customers.fields.industry,
  phone: texts.customers.fields.phone,
  email: texts.customers.fields.email,
  vatId: texts.customers.fields.vatId,
  taxNumber: texts.customers.fields.taxNumber,
  addressLine1: texts.customers.fields.addressLine1,
  postalCode: texts.customers.fields.postalCode,
  city: texts.customers.fields.city,
  country: texts.customers.fields.country,
};

/** Kontakt mit optionalem syncToGoogle-Flag für die Übernahme. */
export interface PendingContact extends ResearchContact {
  syncToGoogle: boolean;
}

interface ApplyData {
  selectedFields: Record<string, string>;
  pendingContacts: PendingContact[];
  socialNotes: string;
}

interface ResearchPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ResearchResult;
  onApply: (data: ApplyData) => void;
}

/**
 * Dialog zur Vorschau und selektiven Übernahme der Recherche-Ergebnisse.
 * Ermöglicht die Auswahl einzelner Firmendaten-Felder und Ansprechpartner.
 */
export function ResearchPreviewDialog({
  open,
  onOpenChange,
  result,
  onApply,
}: ResearchPreviewDialogProps): ReactNode {
  const t = texts.customers.research;

  const companyFields = Object.entries(COMPANY_FIELD_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      value: result.company[key as keyof typeof result.company],
    }))
    .filter((f) => f.value != null && f.value !== '');

  const [selectedCompanyFields, setSelectedCompanyFields] = useState<Set<string>>(
    () => new Set(companyFields.map((f) => f.key)),
  );

  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(
    () => new Set(result.contacts.map((_, i) => i)),
  );

  const [syncToGoogle, setSyncToGoogle] = useState<Record<number, boolean>>(
    () => Object.fromEntries(result.contacts.map((_, i) => [i, true])),
  );

  const toggleCompanyField = (key: string): void => {
    setSelectedCompanyFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleContact = (index: number): void => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSyncGoogle = (index: number): void => {
    setSyncToGoogle((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleApply = (): void => {
    const fields: Record<string, string> = {};
    for (const f of companyFields) {
      if (selectedCompanyFields.has(f.key) && f.value) {
        fields[f.key] = f.value;
      }
    }

    const pending: PendingContact[] = result.contacts
      .filter((_, i) => selectedContacts.has(i))
      .map((c, i) => ({
        ...c,
        syncToGoogle: syncToGoogle[i] ?? true,
      }));

    const socialParts: string[] = [];
    if (result.socialMedia.instagram)
      socialParts.push(`Instagram: ${result.socialMedia.instagram}`);
    if (result.socialMedia.linkedin)
      socialParts.push(`LinkedIn: ${result.socialMedia.linkedin}`);
    if (result.socialMedia.facebook)
      socialParts.push(`Facebook: ${result.socialMedia.facebook}`);
    if (result.socialMedia.xing)
      socialParts.push(`Xing: ${result.socialMedia.xing}`);

    onApply({
      selectedFields: fields,
      pendingContacts: pending,
      socialNotes: socialParts.join('\n'),
    });
  };

  const confidenceColor =
    result.confidence > 0.7
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : result.confidence > 0.4
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  const hasSocial =
    result.socialMedia.instagram ||
    result.socialMedia.linkedin ||
    result.socialMedia.facebook ||
    result.socialMedia.xing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.dialogTitle}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3 pt-2">
            <Badge className={confidenceColor}>
              {t.confidence}: {Math.round(result.confidence * 100)}%
            </Badge>
            {result.sources.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {t.sources}: {result.sources.length} Seiten
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {result.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {result.sources.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {new URL(src).pathname || '/'}
              </a>
            ))}
          </div>
        )}

        {/* Firmendaten */}
        {companyFields.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t.companySection}
            </h3>
            <div className="divide-y rounded-lg border">
              {companyFields.map((f) => (
                <label
                  key={f.key}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCompanyFields.has(f.key)}
                    onChange={() => toggleCompanyField(f.key)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">
                    {f.label}
                  </span>
                  <span className="text-sm font-medium">{f.value}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Ansprechpartner */}
        {result.contacts.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t.contactsSection}
            </h3>
            <div className="grid gap-3">
              {result.contacts.map((c, i) => (
                <Card key={i}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(i)}
                        onChange={() => toggleContact(i)}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                        </p>
                        {c.role && (
                          <p className="text-sm text-muted-foreground">{c.role}</p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {c.email && <span>{c.email}</span>}
                          {c.phoneMobile && <span>{c.phoneMobile}</span>}
                          {c.phoneLandline && <span>{c.phoneLandline}</span>}
                          {c.linkedInUrl && (
                            <a
                              href={c.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedContacts.has(i) && (
                      <label className="flex min-h-[44px] items-center gap-2 pl-7 text-sm">
                        <input
                          type="checkbox"
                          checked={syncToGoogle[i] ?? true}
                          onChange={() => toggleSyncGoogle(i)}
                          className="h-4 w-4"
                        />
                        <span className="flex flex-col">
                          <span>{t.syncGoogle}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.syncGoogleHint}
                          </span>
                        </span>
                      </label>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Social Media */}
        {hasSocial && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t.socialSection}
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {result.socialMedia.instagram && (
                <a
                  href={result.socialMedia.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Instagram
                </a>
              )}
              {result.socialMedia.linkedin && (
                <a
                  href={result.socialMedia.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> LinkedIn
                </a>
              )}
              {result.socialMedia.facebook && (
                <a
                  href={result.socialMedia.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Facebook
                </a>
              )}
              {result.socialMedia.xing && (
                <a
                  href={result.socialMedia.xing}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Xing
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Social-Media-Links werden als Notiz zum Kunden hinzugefügt.
            </p>
          </section>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            {texts.customers.actions.cancel}
          </Button>
          <Button onClick={handleApply} className="min-h-[44px]">
            {t.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
