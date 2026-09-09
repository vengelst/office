import { InvoicePermissionGate } from '@/components/invoices/invoice-permission-gate';

export default function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <InvoicePermissionGate>{children}</InvoicePermissionGate>;
}
