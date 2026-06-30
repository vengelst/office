'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  formatCurrency,
  invoicesApi,
  type CreateInvoiceLineBody,
  type InvoiceDetail,
  type InvoiceLine,
  type InvoiceLineType,
} from '@/lib/invoices';
import { texts } from '@/lib/texts';

const LINE_TYPES: InvoiceLineType[] = [
  'WEEKLY_PACKAGE',
  'OVERTIME',
  'UNIT_BASED',
  'PARTIAL_PAYMENT',
  'CUSTOM',
];

export function LineEditor({
  invoice,
  editable,
  onChanged,
}: {
  invoice: InvoiceDetail;
  editable: boolean;
  onChanged: (updated: InvoiceDetail) => void;
}): React.ReactNode {
  const t = texts.invoices.lines;
  const { toast } = useToast();
  const [editLine, setEditLine] = useState<InvoiceLine | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const lines = invoice.lines;

  const reload = async (): Promise<void> => {
    const updated = await invoicesApi.get(invoice.id);
    onChanged(updated);
  };

  const run = async (
    fn: () => Promise<unknown>,
    successMsg: string,
  ): Promise<void> => {
    setBusy(true);
    try {
      await fn();
      await reload();
      toast({ description: successMsg });
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.invoices.toast.error,
      });
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, dir: -1 | 1): void => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const ids = lines.map((l) => l.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(
      () => invoicesApi.reorderLines(invoice.id, ids),
      texts.invoices.toast.reordered,
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        {lines.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{t.position}</TableHead>
                <TableHead>{t.description}</TableHead>
                <TableHead className="text-right">{t.quantity}</TableHead>
                <TableHead>{t.unit}</TableHead>
                <TableHead className="text-right">{t.unitPrice}</TableHead>
                <TableHead className="text-right">{t.total}</TableHead>
                {editable && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{line.description}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {texts.invoices.lineType[line.lineType]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {line.quantity.toLocaleString('de-DE', {
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.unit ?? ''}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(line.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(line.total)}
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          title={t.moveUp}
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          title={t.moveDown}
                          disabled={busy || index === lines.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          title={t.edit}
                          disabled={busy}
                          onClick={() => setEditLine(line)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => invoicesApi.removeLine(invoice.id, line.id),
                              texts.invoices.toast.lineDeleted,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
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

      {editable ? (
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={busy}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t.add}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{t.readonlyHint}</p>
      )}

      {/* Summenblock */}
      <Card>
        <CardContent className="space-y-2 py-4">
          <SummaryRow label={t.subtotal} value={formatCurrency(invoice.subtotal)} />
          <SummaryRow
            label={`${t.tax} ${invoice.taxRate.toLocaleString('de-DE', {
              maximumFractionDigits: 2,
            })}%`}
            value={formatCurrency(invoice.taxAmount)}
          />
          <div className="border-t pt-2">
            <SummaryRow
              label={t.grandTotal}
              value={formatCurrency(invoice.total)}
              strong
            />
          </div>
        </CardContent>
      </Card>

      {(addOpen || editLine) && (
        <LineDialog
          invoiceId={invoice.id}
          line={editLine}
          onClose={() => {
            setAddOpen(false);
            setEditLine(null);
          }}
          onSaved={async () => {
            setAddOpen(false);
            setEditLine(null);
            await reload();
            toast({ description: texts.invoices.toast.lineSaved });
          }}
        />
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.ReactNode {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          strong ? 'text-base font-semibold' : 'text-sm text-muted-foreground'
        }
      >
        {label}
      </span>
      <span className={`font-mono ${strong ? 'text-base font-bold' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

function LineDialog({
  invoiceId,
  line,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  line: InvoiceLine | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactNode {
  const t = texts.invoices.lineDialog;
  const { toast } = useToast();
  const [lineType, setLineType] = useState<InvoiceLineType>(
    line?.lineType ?? 'CUSTOM',
  );
  const [description, setDescription] = useState(line?.description ?? '');
  const [quantity, setQuantity] = useState(line?.quantity ?? 1);
  const [unit, setUnit] = useState(line?.unit ?? '');
  const [unitPrice, setUnitPrice] = useState(line?.unitPrice ?? 0);
  const [busy, setBusy] = useState(false);

  const preview = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  const save = async (): Promise<void> => {
    if (!description.trim()) return;
    setBusy(true);
    const body: CreateInvoiceLineBody = {
      lineType,
      description: description.trim(),
      quantity: Number(quantity),
      unit: unit.trim() || undefined,
      unitPrice: Number(unitPrice),
    };
    try {
      if (line) {
        await invoicesApi.updateLine(invoiceId, line.id, body);
      } else {
        await invoicesApi.addLine(invoiceId, body);
      }
      onSaved();
    } catch (err) {
      toast({
        description:
          err instanceof ApiError ? err.message : texts.invoices.toast.error,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{line ? t.editTitle : t.addTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.type}</Label>
            <Select
              value={lineType}
              onValueChange={(v) => setLineType(v as InvoiceLineType)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_TYPES.map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    {texts.invoices.lineType[lt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.description}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t.quantity}</Label>
              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.unit}</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Std, Stk, m, Pauschale …"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.unitPrice}</Label>
              <Input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-sm text-muted-foreground">{t.preview}</span>
            <span className="font-mono font-medium">
              {formatCurrency(preview)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={onClose}
            disabled={busy}
          >
            {t.cancel}
          </Button>
          <Button
            className="min-h-[44px]"
            disabled={busy || !description.trim()}
            onClick={save}
          >
            {busy ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
