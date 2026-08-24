'use client';

/**
 * Monteur-Tab: Baustellenfotos (nicht unter Dokumente), filterbar nach Baustelle.
 */

import { useMemo, type ReactNode } from 'react';
import {
  SitePhotosGallery,
  type SitePhotoProjectOption,
} from '@/components/site-photos/site-photos-gallery';
import type { WorkerDetail } from '@/lib/workers';
import { texts } from '@/lib/texts';

export function WorkerSitePhotosTab({
  worker,
}: {
  worker: WorkerDetail;
}): ReactNode {
  const projectOptions = useMemo((): SitePhotoProjectOption[] => {
    const map = new Map<string, string>();
    for (const a of worker.assignments ?? []) {
      map.set(
        a.project.id,
        a.project.projectNumber
          ? `${a.project.projectNumber} · ${a.project.title}`
          : a.project.title,
      );
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [worker.assignments]);

  return (
    <SitePhotosGallery
      entityType="WORKER"
      entityId={worker.id}
      projectOptions={projectOptions}
      emptyHint={texts.sitePhotos.emptyWorker}
    />
  );
}
