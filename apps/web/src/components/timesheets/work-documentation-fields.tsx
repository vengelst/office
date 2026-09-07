'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type WorkActivityOption = { id: string; label: string };

/**
 * Gemeinsame Checkbox-/Freitext-UI für projektbezogene Arbeiten
 * (Clock-Out-Modal und manueller Stundenzettel-Tag).
 */
export function WorkDocumentationFields({
  activities,
  workNotesEnabled,
  selectedIds,
  onSelectedIdsChange,
  workNotes,
  onWorkNotesChange,
  notesLabel,
  notesPlaceholder,
  emptyHint,
  configError,
  configErrorText,
}: {
  activities: WorkActivityOption[];
  workNotesEnabled: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  workNotes: string;
  onWorkNotesChange: (v: string) => void;
  notesLabel: string;
  notesPlaceholder: string;
  emptyHint: string;
  configError?: boolean;
  configErrorText?: string;
}): React.ReactNode {
  const toggle = (id: string, checked: boolean): void => {
    if (checked) {
      onSelectedIdsChange([...selectedIds, id]);
    } else {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    }
  };

  if (configError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {configErrorText}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const checked = selectedIds.includes(a.id);
            return (
              <label
                key={a.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={(e) => toggle(a.id, e.target.checked)}
                />
                <span className="text-sm">{a.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {workNotesEnabled && (
        <div className="space-y-1.5">
          <Label htmlFor="work-notes">{notesLabel}</Label>
          <Textarea
            id="work-notes"
            value={workNotes}
            onChange={(e) => onWorkNotesChange(e.target.value)}
            placeholder={notesPlaceholder}
            rows={3}
            className="min-h-[80px]"
          />
        </div>
      )}
    </div>
  );
}

/** Client-seitige Validierung analog API (für UX vor Submit). */
export function canSubmitWorkDocumentation(opts: {
  workNotesEnabled: boolean;
  activities: WorkActivityOption[];
  selectedIds: string[];
  workNotes: string;
  configurationError?: boolean;
}): boolean {
  if (opts.configurationError) return false;
  const hasCb = opts.selectedIds.length > 0;
  const hasNotes = opts.workNotes.trim().length > 0;
  if (opts.workNotesEnabled) return hasCb || hasNotes;
  return hasCb;
}
