/**
 * Seite: invoices / skonto – Auswertung gezogener Skonti.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatCurrency,
  invoicesApi,
  invoiceNumberLabel,
} from '@/lib/invoices';
import { texts } from '@/lib/texts';

type SkontoRow = Awaited<
  ReturnType<typeof invoicesApi.listSkonto>
>['data'][number];

export default function SkontoReportPage(): React.ReactNode {
  const t = texts.invoices.skontoPage;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SkontoRow[]>([]);
  const [sum, setSum] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await invoicesApi.listSkonto({
        periodFrom: from || undefined,
        periodTo: to || undefined,
        limit: 100,
      });
      setRows(res.data);
      setSum(res.sums.skontoAmount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={t.title} description={t.subtitle} />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>{t.periodFrom}</Label>
          <Input
            type="date"
            className="min-h-[44px]"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t.periodTo}</Label>
          <Input
            type="date"
            className="min-h-[44px]"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button className="min-h-[44px]" onClick={() => void load()}>
          Filtern
        </Button>
        <div className="ml-auto text-sm font-medium">
          {t.sumSkonto}: {formatCurrency(sum)}
        </div>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-8">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        ) : rows.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.empty}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.invoice}</TableHead>
                <TableHead>{t.customer}</TableHead>
                <TableHead className="text-right">{t.amount}</TableHead>
                <TableHead className="text-right">{t.skontoAmount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {new Date(r.paidDate).toLocaleDateString('de-DE')}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${r.invoice.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {invoiceNumberLabel(r.invoice)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.invoice.customer?.companyName ?? '–'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(r.skontoAmount)}
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
