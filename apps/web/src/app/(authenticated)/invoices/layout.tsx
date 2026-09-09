/**
 * Layout-Guard: Rechnungsbereich nur mit Permission invoices.view.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasPermission, useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { texts } from '@/lib/texts';

export default function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;
    if (!hasPermission(user, 'invoices.view')) {
      toast({
        description:
          texts.invoices?.permissionDenied ??
          'Keine Berechtigung für Rechnungen.',
      });
      router.replace('/dashboard');
    }
  }, [isLoading, user, router, toast]);

  if (isLoading || !hasPermission(user, 'invoices.view')) {
    return (
      <p className="text-sm text-muted-foreground p-4">{texts.common.loading}</p>
    );
  }

  return children;
}
