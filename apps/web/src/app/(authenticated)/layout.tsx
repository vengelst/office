'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/lib/auth-context';
import {
  CUSTOMER_PL_HOME,
  isCustomerPlOnly,
  isCustomerPlRoute,
} from '@/lib/roles';
import { texts } from '@/lib/texts';

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Ein reiner Kunden-PL hat keinen Zugriff auf interne Seiten – die API
  // antwortet dort mit 403, das Frontend leitet zusätzlich auf /pl um.
  const plOnly = isCustomerPlOnly(user);
  const blocked = plOnly && !isCustomerPlRoute(pathname);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!isLoading && isAuthenticated && blocked) {
      router.replace(CUSTOMER_PL_HOME);
    }
  }, [isLoading, isAuthenticated, blocked, router]);

  if (isLoading || !isAuthenticated || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {texts.common.loading}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
