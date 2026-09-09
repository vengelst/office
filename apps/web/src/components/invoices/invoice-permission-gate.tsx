'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/roles';

/** Leitet ohne invoices.view vom Rechnungsbereich weg. */
export function InvoicePermissionGate({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const allowed = hasPermission(user, 'invoices.view');

  useEffect(() => {
    if (!isLoading && user && !allowed) {
      router.replace('/dashboard');
    }
  }, [allowed, isLoading, router, user]);

  if (isLoading || !allowed) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Keine Berechtigung …</p>
    );
  }
  return children;
}
