/**
 * Seite: settings / products – Produktkatalog für Rechnungen.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import {
  invoiceProductsApi,
  type InvoiceProduct,
} from '@/lib/invoice-products';
import { formatCurrency } from '@/lib/invoices';
import { texts } from '@/lib/texts';

export default function ProductsSettingsPage(): React.ReactNode {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = texts.settings.products;
  const canEdit = Boolean(
    user?.roles?.includes('SUPERADMIN') || user?.roles?.includes('OFFICE'),
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InvoiceProduct[]>([]);
  const [edit, setEdit] = useState<Partial<InvoiceProduct> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await invoiceProductsApi.list();
    setItems(data);
  }, []);

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [load]);

  const save = async (): Promise<void> => {
    if (!edit?.name?.trim()) return;
    setBusy(true);
    try {
      if (edit.id) {
        await invoiceProductsApi.update(edit.id, {
          code: edit.code ?? undefined,
          name: edit.name,
          unit: edit.unit ?? undefined,
          defaultUnitPrice: edit.defaultUnitPrice ?? 0,
          defaultTaxRate: edit.defaultTaxRate,
          active: edit.active,
        });
      } else {
        await invoiceProductsApi.create({
          code: edit.code ?? undefined,
          name: edit.name,
          unit: edit.unit ?? undefined,
          defaultUnitPrice: edit.defaultUnitPrice ?? 0,
          defaultTaxRate: edit.defaultTaxRate ?? undefined,
          active: edit.active ?? true,
        });
      }
      await load();
      setEdit(null);
      toast({ description: t.toast.saved });
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: InvoiceProduct): Promise<void> => {
    try {
      if (p.active) {
        await invoiceProductsApi.remove(p.id);
      } else {
        await invoiceProductsApi.update(p.id, { active: true });
      }
      await load();
      toast({ description: t.toast.deleted });
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={t.title} description={t.subtitle} />
      </div>

      {canEdit && (
        <Button
          className="min-h-[44px]"
          onClick={() =>
            setEdit({
              name: '',
              code: '',
              unit: 'Stk',
              defaultUnitPrice: 0,
              active: true,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.add}
        </Button>
      )}

      <Card>
        {items.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.empty}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.code}</TableHead>
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.unit}</TableHead>
                <TableHead className="text-right">{t.defaultUnitPrice}</TableHead>
                <TableHead>{t.active}</TableHead>
                {canEdit && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} className={!p.active ? 'opacity-50' : ''}>
                  <TableCell className="font-mono text-sm">{p.code ?? '–'}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.unit ?? '–'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(p.defaultUnitPrice)}
                  </TableCell>
                  <TableCell>{p.active ? 'Ja' : 'Nein'}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => setEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="min-h-[44px]"
                          onClick={() => void toggleActive(p)}
                        >
                          {p.active ? t.deactivate : t.activate}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{edit.id ? t.edit : t.add}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t.code}</Label>
                <Input
                  className="min-h-[44px]"
                  value={edit.code ?? ''}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.name}</Label>
                <Input
                  className="min-h-[44px]"
                  value={edit.name ?? ''}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.unit}</Label>
                  <Input
                    className="min-h-[44px]"
                    value={edit.unit ?? ''}
                    onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.defaultUnitPrice}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="min-h-[44px]"
                    value={edit.defaultUnitPrice ?? 0}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        defaultUnitPrice: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setEdit(null)}
              >
                {t.cancel}
              </Button>
              <Button
                className="min-h-[44px]"
                disabled={busy || !edit.name?.trim()}
                onClick={() => void save()}
              >
                {busy ? t.saving : t.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
