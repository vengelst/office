'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import type { PendingWorkDocumentation, WorkDocumentationBody } from '@/lib/timesheets';
import {
  WorkDocumentationFields,
  canSubmitWorkDocumentation,
} from '@/components/timesheets/work-documentation-fields';

/**
 * Pflicht-Modal nach Clock-Out / bei Pending-Reload.
 */
export function WorkDocumentationModal({
  pending,
  title,
  description,
  saveLabel,
  notesLabel,
  notesPlaceholder,
  emptyHint,
  configErrorText,
  validationHint,
  onSave,
  busy,
  error,
}: {
  pending: PendingWorkDocumentation;
  title: string;
  description: string;
  saveLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  emptyHint: string;
  configErrorText: string;
  validationHint: string;
  onSave: (body: WorkDocumentationBody) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}): React.ReactNode {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = canSubmitWorkDocumentation({
    workNotesEnabled: pending.workNotesEnabled,
    activities: pending.workActivities,
    selectedIds,
    workNotes,
    configurationError: pending.configurationError,
  });

  const submit = async (): Promise<void> => {
    if (!canSave) {
      setLocalError(validationHint);
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await onSave({
        projectWorkActivityIds: selectedIds,
        workNotes: pending.workNotesEnabled ? workNotes : undefined,
      });
    } catch (err) {
      setLocalError(err instanceof ApiError ? err.message : validationHint);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => { /* Pflicht – kein Schließen */ }}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <WorkDocumentationFields
          activities={pending.workActivities}
          workNotesEnabled={pending.workNotesEnabled}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          workNotes={workNotes}
          onWorkNotesChange={setWorkNotes}
          notesLabel={notesLabel}
          notesPlaceholder={notesPlaceholder}
          emptyHint={emptyHint}
          configError={pending.configurationError}
          configErrorText={configErrorText}
        />
        {(localError || error) && (
          <p className="text-sm text-destructive" role="alert">
            {localError || error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!canSave || saving || busy || pending.configurationError}
            onClick={() => void submit()}
          >
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
