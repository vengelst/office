'use client';

/**
 * Projekt-Tab: Baustellendokumentation / Baustellenfotos.
 */

import type { ReactNode } from 'react';
import { SitePhotosGallery } from '@/components/site-photos/site-photos-gallery';
import { texts } from '@/lib/texts';

export function ProjectSitePhotosTab({
  projectId,
}: {
  projectId: string;
}): ReactNode {
  return (
    <SitePhotosGallery
      entityType="PROJECT"
      entityId={projectId}
      emptyHint={texts.sitePhotos.emptyProject}
    />
  );
}
