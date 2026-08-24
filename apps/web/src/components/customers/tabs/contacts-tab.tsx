/**
 * Komponente: customers / tabs / contacts-tab (Office-Web).
 * Domänen-UI – Orchestrierung; Formular/Scan/Helfer ausgelagert.
 */

'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Camera,
  CreditCard,
  Gift,
  Linkedin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { MailLink, PhoneLink } from '@/components/customers/contact-links';
import { EmptyState } from '@/components/customers/empty-state';
import { ContactSearchDialog } from '@/components/customers/contact-search-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  customersApi,
  documentsApi,
  type CustomerBranch,
  type CustomerContact,
  type DocumentItem,
} from '@/lib/customers';
import { ApiError, TOKEN_STORAGE_KEY } from '@/lib/api-client';
import { uploadDocument } from '@/lib/upload';
import { scanBusinessCard, type BusinessCardData } from '@/lib/ocr';
import { formatDate } from '@/lib/format';
import { texts } from '@/lib/texts';
import { AuthImage } from './contacts/contacts-helpers';
import { ContactFormDialog } from './contacts/contact-form-dialog';
import { ContactScanDialog } from './contacts/contact-scan-dialog';
import { normalizeSalutation } from './contacts/contact-salutation-select';
import {
  ALL,
  API_BASE_URL,
  EMPTY,
  NONE,
  type ContactsExternalAction,
  type FormState,
} from './contacts/contacts-types';

export type { ContactsExternalAction } from './contacts/contacts-types';

export function ContactsTab({
  customerId,
  contacts,
  branches,
  onChange,
  externalAction,
  onExternalActionDone,
}: {
  customerId: string;
  contacts: CustomerContact[];
  branches: CustomerBranch[];
  onChange: () => void;
  externalAction?: ContactsExternalAction | null;
  onExternalActionDone?: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerContact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const fileInput = useRef<HTMLInputElement>(null);
  const scanInput = useRef<HTMLInputElement>(null);

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<BusinessCardData | null>(null);
  const [scanForm, setScanForm] = useState<FormState>(EMPTY);

  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  /** Lädt Visitenkarten-Bilder aller Kontakte parallel und baut eine Map contactId → Bild-URL. */
  const loadBusinessCards = useCallback(() => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;
    if (!token || contacts.length === 0) return;

    Promise.all(
      contacts.map((c) =>
        documentsApi
          .listByEntity('CONTACT', c.id)
          .then((docs) => ({ contactId: c.id, docs }))
          .catch(() => ({ contactId: c.id, docs: [] as DocumentItem[] })),
      ),
    ).then((results) => {
      const map: Record<string, string> = {};
      for (const { contactId, docs } of results) {
        const card = docs.find(
          (d) =>
            d.documentType === 'BUSINESS_CARD' &&
            d.mimeType.startsWith('image/'),
        );
        if (card) {
          map[contactId] = `${API_BASE_URL}/documents/${card.id}/download`;
        }
      }
      setCardImages(map);
    });
  }, [contacts]);

  useEffect(() => {
    loadBusinessCards();
  }, [loadBusinessCards]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const branchName = (id: string | null): string => {
    if (!id) return t.headquarters;
    return branches.find((b) => b.id === id)?.name ?? t.headquarters;
  };

  // Filter nach Niederlassung (ALL = alle, NONE = Hauptsitz, sonst branchId)
  const visibleContacts =
    filter === ALL
      ? contacts
      : contacts.filter((c) => (c.branchId ?? NONE) === filter);
  const grouped = filter === ALL;

  // Gruppierung nach Niederlassung / Hauptsitz (nur im "Alle"-Modus relevant)
  const groups = new Map<string, CustomerContact[]>();
  for (const c of visibleContacts) {
    const key = c.branchId ?? NONE;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const openCreate = (branchId: string = NONE): void => {
    setEditing(null);
    setForm({ ...EMPTY, branchId });
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerContact): void => {
    setEditing(c);
    setForm({
      title: c.title ?? '',
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? '',
      department: c.department ?? '',
      branchId: c.branchId ?? NONE,
      email: c.email ?? '',
      phoneMobile: c.phoneMobile ?? '',
      phoneLandline: c.phoneLandline ?? '',
      birthday: c.birthday ? c.birthday.slice(0, 10) : '',
      linkedInUrl: c.linkedInUrl ?? '',
      preferredContactMethod: c.preferredContactMethod ?? '',
      isAccountingContact: c.isAccountingContact,
      isProjectContact: c.isProjectContact,
      isSignatory: c.isSignatory,
      syncToGoogle: c.syncToGoogle ?? true,
    });
    setDialogOpen(true);
  };

  // Externe Aktionen aus dem Niederlassungs-Detail (Kontakt öffnen / anlegen).
  useEffect(() => {
    if (!externalAction) return;
    if (externalAction.kind === 'edit') {
      openEdit(externalAction.contact);
    } else if (externalAction.kind === 'scan') {
      openScanDialog();
    } else {
      openCreate(externalAction.branchId ?? NONE);
    }
    onExternalActionDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAction]);

  const save = (): void => {
    const payload = {
      title: form.title || undefined,
      firstName: form.firstName,
      lastName: form.lastName,
      role: form.role || undefined,
      department: form.department || undefined,
      branchId: form.branchId === NONE ? undefined : form.branchId,
      email: form.email || undefined,
      phoneMobile: form.phoneMobile || undefined,
      phoneLandline: form.phoneLandline || undefined,
      birthday: form.birthday || undefined,
      linkedInUrl: form.linkedInUrl || undefined,
      preferredContactMethod: form.preferredContactMethod || undefined,
      isAccountingContact: form.isAccountingContact,
      isProjectContact: form.isProjectContact,
      isSignatory: form.isSignatory,
      syncToGoogle: form.syncToGoogle,
    };
    setSaving(true);
    const req = editing
      ? customersApi.updateContact(customerId, editing.id, payload)
      : customersApi.createContact(customerId, payload);
    req
      .then(() => {
        toast({ description: t.toast.updated });
        setDialogOpen(false);
        onChange();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const confirmDelete = (): void => {
    if (!deleteId) return;
    customersApi
      .removeContact(customerId, deleteId)
      .then(() => {
        toast({ description: t.toast.itemDeleted });
        onChange();
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }))
      .finally(() => setDeleteId(null));
  };

  const triggerUpload = (contactId: string): void => {
    setUploadFor(contactId);
    fileInput.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadFor) return;
    uploadDocument({
      file,
      documentType: 'BUSINESS_CARD',
      entityType: 'CONTACT',
      entityId: uploadFor,
    })
      .then(() => {
        toast({ description: t.toast.uploaded });
        loadBusinessCards();
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setUploadFor(null));
  };

  /** Öffnet den Visitenkarten-Scan-Dialog und setzt alle Scan-bezogenen States zurück. */
  const openScanDialog = (): void => {
    setScanDialogOpen(true);
    setScanResult(null);
    setScanPreview(null);
    setScanFile(null);
    setScanForm(EMPTY);
    setScanning(false);
  };

  /** Verarbeitet ein ausgewähltes Visitenkarten-Bild: OCR-Analyse und Formular-Befüllung. */
  const onScanFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const url = URL.createObjectURL(file);
    setScanPreview(url);
    setScanFile(file);
    setScanning(true);
    setScanResult(null);

    scanBusinessCard(file)
      .then((data) => {
        setScanResult(data);
        setScanForm({
          title: normalizeSalutation(data.title.value),
          firstName: data.firstName.value ?? '',
          lastName: data.lastName.value ?? '',
          role: data.role.value ?? '',
          department: data.department.value ?? '',
          branchId: NONE,
          email: data.email.value ?? '',
          phoneMobile: data.phoneMobile.value ?? '',
          phoneLandline: data.phoneLandline.value ?? '',
          birthday: '',
          linkedInUrl: data.linkedInUrl.value ?? '',
          preferredContactMethod: '',
          isAccountingContact: false,
          isProjectContact: false,
          isSignatory: false,
          syncToGoogle: true,
        });
        toast({ description: t.toast.scanSuccess });
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.scanError,
        }),
      )
      .finally(() => setScanning(false));
  };

  /** Speichert den via OCR erkannten Kontakt und lädt das Visitenkarten-Bild als Dokument hoch. */
  const saveScanResult = (): void => {
    const payload = {
      title: scanForm.title || undefined,
      firstName: scanForm.firstName,
      lastName: scanForm.lastName,
      role: scanForm.role || undefined,
      department: scanForm.department || undefined,
      branchId: scanForm.branchId === NONE ? undefined : scanForm.branchId,
      email: scanForm.email || undefined,
      phoneMobile: scanForm.phoneMobile || undefined,
      phoneLandline: scanForm.phoneLandline || undefined,
      birthday: scanForm.birthday || undefined,
      linkedInUrl: scanForm.linkedInUrl || undefined,
      preferredContactMethod: scanForm.preferredContactMethod || undefined,
      isAccountingContact: scanForm.isAccountingContact,
      isProjectContact: scanForm.isProjectContact,
      isSignatory: scanForm.isSignatory,
      syncToGoogle: scanForm.syncToGoogle,
    };
    setSaving(true);
    customersApi
      .createContact(customerId, payload)
      .then(async (contact) => {
        if (scanFile) {
          try {
            await uploadDocument({
              file: scanFile,
              documentType: 'BUSINESS_CARD',
              title: `Visitenkarte ${scanForm.firstName} ${scanForm.lastName}`.trim(),
              entityType: 'CONTACT',
              entityId: contact.id,
            });
          } catch {
            toast({
              variant: 'destructive',
              description: 'Kontakt erstellt, aber Visitenkarte konnte nicht gespeichert werden.',
            });
          }
        }
        toast({ description: t.toast.updated });
        setScanDialogOpen(false);
        onChange();
        setTimeout(loadBusinessCards, 500);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFileSelected}
      />
      <input
        ref={scanInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onScanFileSelected}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="min-h-[44px] w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.allBranches}</SelectItem>
            <SelectItem value={NONE}>{t.headquarters}</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSearchDialogOpen(true)}
            className="min-h-[44px]"
          >
            <Search className="h-4 w-4" />
            {t.contactSearch.button}
          </Button>
          <Button
            variant="outline"
            onClick={openScanDialog}
            className="min-h-[44px]"
          >
            <Camera className="h-4 w-4" />
            {t.actions.scanBusinessCard}
          </Button>
          <Button onClick={() => openCreate()} className="min-h-[44px]">
            <Plus className="h-4 w-4" />
            {t.actions.addContact}
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          message={t.empties.contacts}
          actionLabel={t.empties.addNow}
          onAction={() => openCreate()}
        />
      ) : visibleContacts.length === 0 ? (
        <EmptyState message={t.empties.contacts} />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([key, list]) => (
            <div key={key} className="space-y-3">
              {grouped && (
                <h4 className="text-sm font-semibold text-muted-foreground">
                  {branchName(key === NONE ? null : key)}
                </h4>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {list.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {[c.title, c.firstName, c.lastName]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          {(c.role || c.department) && (
                            <p className="text-sm text-muted-foreground">
                              {[c.role, c.department]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              onClick={() => openEdit(c)}
                              aria-label={t.actions.edit}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-destructive"
                              onClick={() => setDeleteId(c.id)}
                              aria-label={t.actions.delete}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {cardImages[c.id] && (
                            <AuthImage
                              src={cardImages[c.id]}
                              alt={`Visitenkarte ${c.firstName} ${c.lastName}`}
                              className="h-16 w-28 cursor-pointer rounded border object-cover transition-opacity hover:opacity-90"
                              onClick={(blobUrl) => setLightboxSrc(blobUrl)}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-sm">
                        {c.email && <MailLink email={c.email} />}
                        {c.phoneMobile && (
                          <PhoneLink phone={c.phoneMobile} mobile />
                        )}
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
                            className="inline-flex min-h-[44px] items-center gap-1 text-primary hover:underline"
                          >
                            <Linkedin className="h-3 w-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {c.isAccountingContact && (
                          <Badge variant="outline">
                            {t.fields.isAccountingContact}
                          </Badge>
                        )}
                        {c.isProjectContact && (
                          <Badge variant="outline">
                            {t.fields.isProjectContact}
                          </Badge>
                        )}
                        {c.isSignatory && (
                          <Badge variant="outline">
                            {t.fields.isSignatory}
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        disabled={uploadFor === c.id}
                        onClick={() => triggerUpload(c.id)}
                      >
                        <CreditCard className="h-4 w-4" />
                        {t.actions.uploadBusinessCard}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={Boolean(editing)}
        form={form}
        setFormField={set}
        branches={branches}
        saving={saving}
        onSave={save}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t.actions.delete}
        description={t.deleteConfirm}
        onConfirm={confirmDelete}
      />

      <ContactScanDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        scanning={scanning}
        scanPreview={scanPreview}
        scanResult={scanResult}
        scanForm={scanForm}
        setScanForm={setScanForm}
        branches={branches}
        saving={saving}
        scanInputRef={scanInput}
        onSave={saveScanResult}
      />

      <ContactSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        customerId={customerId}
        onContactsCreated={onChange}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxSrc}
            alt="Visitenkarte"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
