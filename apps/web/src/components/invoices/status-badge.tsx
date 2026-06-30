import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';
import type { InvoiceStatus } from '@/lib/invoices';

/** Farbcodierung der Rechnungsstatus (Entwurf grau, Versendet blau, … ). */
const STYLES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PARTIALLY_PAID:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function InvoiceStatusBadge({
  status,
}: {
  status: InvoiceStatus;
}): React.ReactNode {
  return (
    <Badge variant="outline" className={cn('border-transparent', STYLES[status])}>
      {texts.invoices.status[status]}
    </Badge>
  );
}
