'use client';

/**
 * Arbeitsitems-Liste in der persönlichen Monteur-App (`/worker-app`).
 * Nutzt dieselben Komponenten wie der Kiosk – siehe
 * `src/components/worker-work-items/` (SPEZ-arbeitsitems.md Abschnitt 13).
 */
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WorkItemsList } from '@/components/worker-work-items/work-items-list';
import { both, T } from '@/lib/i18n-work-items';
import { useWorkerSessionGuard } from '../use-worker-session-guard';

export default function WorkerWorkItemsPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-center text-sm text-gray-500">{both(T.loading)}</p>
      }
    >
      <WorkItemsRoute />
    </Suspense>
  );
}

function WorkItemsRoute(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get('projectId') ?? undefined;
  const worker = useWorkerSessionGuard();

  if (!worker) {
    return (
      <p className="p-6 text-center text-sm text-gray-500">{both(T.loading)}</p>
    );
  }

  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';

  return (
    <WorkItemsList
      workerId={worker.id}
      projectId={projectId}
      onSelect={(id) => router.push(`/worker-app/work-items/${id}${query}`)}
      onBack={() => router.push('/worker-app/dashboard')}
    />
  );
}
