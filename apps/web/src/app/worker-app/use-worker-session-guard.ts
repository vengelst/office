'use client';

/**
 * Auth-Gate der Monteur-App: liefert das gespeicherte Monteur-Profil oder
 * schickt ohne Worker-Token zurück zur PIN-Seite – dieselbe Logik wie im
 * Dashboard, damit die Arbeitsitems-Routen sich identisch verhalten.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredWorker, getWorkerToken, type WorkerMe } from '@/lib/timesheets';

export function useWorkerSessionGuard(): WorkerMe | null {
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerMe | null>(null);

  useEffect(() => {
    if (!getWorkerToken()) {
      router.replace('/worker-app');
      return;
    }
    setWorker(getStoredWorker());
  }, [router]);

  return worker;
}
