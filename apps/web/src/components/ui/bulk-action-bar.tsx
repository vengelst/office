'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Aktionsleiste für Mehrfachauswahl (Anzahl + Löschen). */
export function BulkActionBar({
  count,
  onDelete,
  deleteLabel = 'Löschen',
}: {
  count: number;
  onDelete: () => void;
  deleteLabel?: string;
}): React.ReactNode {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{count} ausgewählt</span>
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px] text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        {deleteLabel}
      </Button>
    </div>
  );
}
