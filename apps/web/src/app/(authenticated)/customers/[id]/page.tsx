'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerForm } from '@/components/customers/customer-form';
import { RatingBadge } from '@/components/customers/rating-badge';
import { ConfirmDialog } from '@/components/customers/confirm-dialog';
import { EmailsTab } from '@/components/customers/tabs/emails-tab';
import { BankAccountsTab } from '@/components/customers/tabs/bank-accounts-tab';
import { BranchesTab } from '@/components/customers/tabs/branches-tab';
import {
  ContactsTab,
  type ContactsExternalAction,
} from '@/components/customers/tabs/contacts-tab';
import { DocumentsTab } from '@/components/customers/tabs/documents-tab';
import { useToast } from '@/components/ui/use-toast';
import { customersApi, type CustomerDetail } from '@/lib/customers';
import { ApiError } from '@/lib/api-client';
import { texts } from '@/lib/texts';

export default function CustomerDetailPage(): React.ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const t = texts.customers;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('master');
  const [contactAction, setContactAction] =
    useState<ContactsExternalAction | null>(null);

  const load = useCallback(() => {
    customersApi
      .get(id)
      .then((c) => {
        setCustomer(c);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = (payload: Record<string, unknown>): void => {
    setSaving(true);
    customersApi
      .update(id, payload)
      .then((c) => {
        setCustomer(c);
        toast({ description: t.toast.updated });
      })
      .catch((err) =>
        toast({
          variant: 'destructive',
          description: err instanceof ApiError ? err.message : t.toast.error,
        }),
      )
      .finally(() => setSaving(false));
  };

  const handleDelete = (): void => {
    customersApi
      .remove(id)
      .then(() => {
        toast({ description: t.toast.deleted });
        router.push('/customers');
      })
      .catch(() => toast({ variant: 'destructive', description: t.toast.error }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/customers">{t.backToList}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground">
          {t.title}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">
          {customer.companyName}
        </span>
      </nav>

      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {customer.companyName}
            </h1>
            <RatingBadge rating={customer.rating} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {customer.customerNumber}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px] text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          {t.actions.delete}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="master" className="min-h-[44px]">
            {t.tabs.master}
          </TabsTrigger>
          <TabsTrigger value="emails" className="min-h-[44px]">
            {t.tabs.emails}
          </TabsTrigger>
          <TabsTrigger value="bankAccounts" className="min-h-[44px]">
            {t.tabs.bankAccounts}
          </TabsTrigger>
          <TabsTrigger value="branches" className="min-h-[44px]">
            {t.tabs.branches}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="min-h-[44px]">
            {t.tabs.contacts}
          </TabsTrigger>
          <TabsTrigger value="documents" className="min-h-[44px]">
            {t.tabs.documents}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master">
          <Card>
            <CardContent className="pt-6">
              <CustomerForm
                customer={customer}
                submitting={saving}
                onSubmit={handleSave}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <EmailsTab
            customerId={id}
            emails={customer.emails}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="bankAccounts">
          <BankAccountsTab
            customerId={id}
            bankAccounts={customer.bankAccounts}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="branches">
          <BranchesTab
            customerId={id}
            branches={customer.branches}
            contacts={customer.contacts}
            onChange={load}
            onOpenContact={(c) => {
              setContactAction({ kind: 'edit', contact: c });
              setActiveTab('contacts');
            }}
            onAddContact={(branchId) => {
              setContactAction({ kind: 'create', branchId });
              setActiveTab('contacts');
            }}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab
            customerId={id}
            contacts={customer.contacts}
            branches={customer.branches}
            onChange={load}
            externalAction={contactAction}
            onExternalActionDone={() => setContactAction(null)}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab entityId={id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.deleteTitle}
        description={t.deleteConfirm}
        onConfirm={handleDelete}
      />
    </div>
  );
}
