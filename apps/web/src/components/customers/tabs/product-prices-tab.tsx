/**
 * Kunden-Tab: Sonderpreise je Produkt.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  invoiceProductsApi,
  type CustomerProductPrice,
  type InvoiceProduct,
} from '@/lib/invoice-products';
import { formatCurrency } from '@/lib/invoices';
import { texts } from '@/lib/texts';

export function ProductPricesTab({
  customerId,
}: {
  customerId: string;
}): React.ReactNode {
  const t = texts.customers.productPrices;
  const { toast } = useToast();
  const [prices, setPrices] = useState<CustomerProductPrice[]>([]);
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, prod] = await Promise.all([
      invoiceProductsApi.listCustomerPrices(customerId),
      invoiceProductsApi.list({ activeOnly: true }),
    ]);
    setPrices(p);
    setProducts(prod);
  }, [customerId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const save = async (): Promise<void> => {
    if (!productId) return;
    setBusy(true);
    try {
      await invoiceProductsApi.upsertCustomerPrice(customerId, {
        productId,
        unitPrice: Number(unitPrice),
      });
      await load();
      setProductId('');
      setUnitPrice(0);
      toast({ description: t.toast.saved });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (pid: string): Promise<void> => {
    try {
      await invoiceProductsApi.removeCustomerPrice(customerId, pid);
      await load();
      toast({ description: t.toast.deleted });
    } catch (err) {
      toast({
        description: err instanceof ApiError ? err.message : t.toast.error,
      });
    }
  };

  const used = new Set(prices.map((p) => p.productId));
  const available = products.filter((p) => !used.has(p.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label>{t.selectProduct}</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder={t.selectProduct} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ` (${p.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.customerPrice}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="min-h-[44px]"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="min-h-[44px] w-full"
                disabled={busy || !productId}
                onClick={() => void save()}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.add}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        {prices.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.empty}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.product}</TableHead>
                <TableHead className="text-right">{t.defaultPrice}</TableHead>
                <TableHead className="text-right">{t.customerPrice}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.product.name}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrency(row.product.defaultUnitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.unitPrice)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive"
                      title={t.remove}
                      onClick={() => void remove(row.productId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
