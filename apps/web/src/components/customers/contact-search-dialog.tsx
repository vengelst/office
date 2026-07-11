'use client';

import { useState, type ReactNode } from 'react';
import { Globe, Loader2, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { customersApi } from '@/lib/customers';
import { researchApi, type ResearchContact } from '@/lib/research';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

interface SelectedContact extends ResearchContact {
  selected: boolean;
  syncToGoogle: boolean;
}

export function ContactSearchDialog({
  open,
  onOpenChange,
  customerId,
  onContactsCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onContactsCreated: () => void;
}): ReactNode {
  const { toast } = useToast();
  const t = texts.customers.contactSearch;
  const tCustomers = texts.customers;

  const [url, setUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<SelectedContact[]>([]);
  const [searched, setSearched] = useState(false);

  const reset = (): void => {
    setUrl('');
    setSearching(false);
    setImporting(false);
    setContacts([]);
    setSearched(false);
  };

  const handleOpenChange = (o: boolean): void => {
    if (!o) reset();
    onOpenChange(o);
  };

  const search = (): void => {
    if (!url.trim()) return;
    setSearching(true);
    setContacts([]);
    setSearched(false);

    researchApi
      .lookup(url.trim())
      .then((result) => {
        setContacts(
          result.contacts.map((c) => ({
            ...c,
            selected: true,
            syncToGoogle: true,
          })),
        );
        setSearched(true);
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description:
            err instanceof ApiError
              ? err.message
              : tCustomers.research.serviceError,
        }),
      )
      .finally(() => setSearching(false));
  };

  const toggleAll = (selected: boolean): void => {
    setContacts((prev) => prev.map((c) => ({ ...c, selected })));
  };

  const toggle = (idx: number, key: 'selected' | 'syncToGoogle'): void => {
    setContacts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [key]: !c[key] } : c)),
    );
  };

  const selectedCount = contacts.filter((c) => c.selected).length;

  const importContacts = async (): Promise<void> => {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) return;

    setImporting(true);
    let created = 0;

    for (const c of selected) {
      try {
        await customersApi.createContact(customerId, {
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          role: c.role || undefined,
          department: c.department || undefined,
          email: c.email || undefined,
          phoneMobile: c.phoneMobile || undefined,
          phoneLandline: c.phoneLandline || undefined,
          linkedInUrl: c.linkedInUrl || undefined,
          syncToGoogle: c.syncToGoogle,
        });
        created++;
      } catch {
        // continue with next
      }
    }

    setImporting(false);

    if (created > 0) {
      toast({ description: t.success(created) });
      onContactsCreated();
      handleOpenChange(false);
    } else {
      toast({ variant: 'destructive', description: tCustomers.toast.error });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.button}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.placeholder}
            className="min-h-[44px]"
            onKeyDown={(e) => e.key === 'Enter' && search()}
            disabled={searching}
          />
          <Button
            onClick={search}
            disabled={searching || !url.trim()}
            className="min-h-[44px]"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {searching && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          </div>
        )}

        {searched && !searching && contacts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Globe className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t.noResults}</p>
          </div>
        )}

        {contacts.length > 0 && !searching && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t.found(contacts.length)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] text-xs"
                  onClick={() => toggleAll(true)}
                >
                  {t.selectAll}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] text-xs"
                  onClick={() => toggleAll(false)}
                >
                  {t.selectNone}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {contacts.map((c, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 transition-colors ${
                    c.selected
                      ? 'border-primary/30 bg-primary/5'
                      : 'opacity-60'
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={() => toggle(idx, 'selected')}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') ||
                          '–'}
                      </p>
                      {(c.role || c.department) && (
                        <p className="text-sm text-muted-foreground">
                          {[c.role, c.department].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {c.email && <span>{c.email}</span>}
                        {c.phoneMobile && <span>{c.phoneMobile}</span>}
                        {c.phoneLandline && <span>{c.phoneLandline}</span>}
                      </div>
                    </div>
                  </label>
                  {c.selected && (
                    <label className="ml-7 mt-2 flex min-h-[44px] items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={c.syncToGoogle}
                        onChange={() => toggle(idx, 'syncToGoogle')}
                        className="h-3.5 w-3.5"
                      />
                      {t.syncToGoogle}
                    </label>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {contacts.length > 0 && !searching && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="min-h-[44px]"
            >
              {tCustomers.actions.cancel}
            </Button>
            <Button
              onClick={importContacts}
              disabled={importing || selectedCount === 0}
              className="min-h-[44px]"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.importing}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t.import} ({selectedCount})
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
