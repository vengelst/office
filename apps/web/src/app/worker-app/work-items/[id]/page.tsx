'use client';

/**
 * Item-Detail in der persönlichen Monteur-App (`/worker-app`).
 * Gleiche Komponente wie im Kiosk (`src/components/worker-work-items/`).
 */
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { WorkItemDetail } from '@/components/worker-work-items/work-item-detail';
import { both, T } from '@/lib/i18n-work-items';
import { useWorkerSessionGuard } from '../../use-worker-session-guard';

export default function WorkerWorkItemDetailPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-center text-sm text-gray-500">{both(T.loading)}</p>
      }
    >
      <WorkItemDetailRoute />
    </Suspense>
  );
}

function WorkItemDetailRoute(): ReactNode {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const search = useSearchParams();
  const worker = useWorkerSessionGuard();

  const itemId = typeof routeParams?.id === 'string' ? routeParams.id : '';
  const projectId = search.get('projectId');
  const listUrl = projectId
    ? `/worker-app/work-items?projectId=${encodeURIComponent(projectId)}`
    : '/worker-app/work-items';

  if (!worker || !itemId) {
    return (
      <p className="p-6 text-center text-sm text-gray-500">{both(T.loading)}</p>
    );
  }

  return (
    <WorkItemDetail
      itemId={itemId}
      workerId={worker.id}
      onBack={() => router.push(listUrl)}
    />
  );
}
