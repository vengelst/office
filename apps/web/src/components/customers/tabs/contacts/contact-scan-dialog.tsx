/**
 * Dialog: Visitenkarte scannen (OCR) und Kontakt anlegen.
 */

'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/customers/customer-form';
import type { CustomerBranch } from '@/lib/customers';
import type { BusinessCardData } from '@/lib/ocr';
import { texts } from '@/lib/texts';
import { Checkbox } from './contacts-helpers';
import { ContactSalutationSelect } from './contact-salutation-select';
import {
  CONTACT_METHODS,
  NONE,
  type FormState,
} from './contacts-types';

export function ContactScanDialog({
  open,
  onOpenChange,
  scanning,
  scanPreview,
  scanResult,
  scanForm,
  setScanForm,
  branches,
  saving,
  scanInputRef,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanning: boolean;
  scanPreview: string | null;
  scanResult: BusinessCardData | null;
  scanForm: FormState;
  setScanForm: Dispatch<SetStateAction<FormState>>;
  branches: CustomerBranch[];
  saving: boolean;
  scanInputRef: RefObject<HTMLInputElement | null>;
  onSave: () => void;
}): React.ReactNode {
  const t = texts.customers;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.actions.scanBusinessCard}</DialogTitle>
          </DialogHeader>

          {!scanResult && !scanning && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Fotografieren oder Bild einer Visitenkarte hochladen
              </p>
              <Button
                onClick={() => scanInputRef.current?.click()}
                className="min-h-[44px]"
              >
                <Camera className="h-4 w-4" />
                Bild auswählen
              </Button>
            </div>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Visitenkarte wird analysiert …
              </p>
              {scanPreview && (
                <img
                  src={scanPreview}
                  alt="Visitenkarte"
                  className="mt-4 max-h-48 rounded-lg border object-contain"
                />
              )}
            </div>
          )}

          {scanResult && !scanning && (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  {scanPreview && (
                    <img
                      src={scanPreview}
                      alt="Visitenkarte"
                      className="w-full rounded-lg border object-contain"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => scanInputRef.current?.click()}
                  >
                    Anderes Bild wählen
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label={t.fields.title}>
                      <ContactSalutationSelect
                        value={scanForm.title}
                        onChange={(v) =>
                          setScanForm((p) => ({ ...p, title: v }))
                        }
                        noneLabel={t.fields.titleNone}
                      />
                    </Field>
                    <Field label={t.fields.firstName} required>
                      <Input
                        value={scanForm.firstName}
                        onChange={(e) =>
                          setScanForm((p) => ({ ...p, firstName: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                    <Field label={t.fields.lastName} required>
                      <Input
                        value={scanForm.lastName}
                        onChange={(e) =>
                          setScanForm((p) => ({ ...p, lastName: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t.fields.role}>
                      <Input
                        value={scanForm.role}
                        onChange={(e) =>
                          setScanForm((p) => ({ ...p, role: e.target.value }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                    <Field label={t.fields.department}>
                      <Input
                        value={scanForm.department}
                        onChange={(e) =>
                          setScanForm((p) => ({
                            ...p,
                            department: e.target.value,
                          }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                  </div>
                  <Field label={t.fields.email}>
                    <Input
                      type="email"
                      value={scanForm.email}
                      onChange={(e) =>
                        setScanForm((p) => ({ ...p, email: e.target.value }))
                      }
                      className="min-h-[44px]"
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t.fields.phoneMobile}>
                      <Input
                        value={scanForm.phoneMobile}
                        onChange={(e) =>
                          setScanForm((p) => ({
                            ...p,
                            phoneMobile: e.target.value,
                          }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                    <Field label={t.fields.phoneLandline}>
                      <Input
                        value={scanForm.phoneLandline}
                        onChange={(e) =>
                          setScanForm((p) => ({
                            ...p,
                            phoneLandline: e.target.value,
                          }))
                        }
                        className="min-h-[44px]"
                      />
                    </Field>
                  </div>
                  <Field label={t.fields.linkedInUrl}>
                    <Input
                      value={scanForm.linkedInUrl}
                      onChange={(e) =>
                        setScanForm((p) => ({
                          ...p,
                          linkedInUrl: e.target.value,
                        }))
                      }
                      className="min-h-[44px]"
                    />
                  </Field>
                  <Field label={t.fields.branch}>
                    <Select
                      value={scanForm.branchId}
                      onValueChange={(v) =>
                        setScanForm((p) => ({ ...p, branchId: v }))
                      }
                    >
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t.headquarters}</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px]"
                >
                  {t.actions.cancel}
                </Button>
                <Button
                  onClick={onSave}
                  disabled={saving || !scanForm.firstName || !scanForm.lastName}
                  className="min-h-[44px]"
                >
                  {saving ? t.actions.saving : t.actions.addContact}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
  );
}
