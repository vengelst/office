import { Coffee, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDuration, formatTime, type ClockStatus } from '@/lib/timesheets';
import type { ActivityTypeItem } from '@/lib/activity-types';
import type { WorkerMeAssignment } from '@/lib/timesheets';
import { cn } from '@/lib/utils';

interface ClockStatusSectionProps {
  clockedIn: boolean;
  onBreak: boolean;
  status: ClockStatus | null;
  elapsedSeconds: number;
  masterEngineer: boolean;
  activityTypes: ActivityTypeItem[];
  selectedActivityTypeId: string;
  onActivityChange: (activityTypeId: string) => void;
  onSetActivityTypeId: (activityTypeId: string) => void;
  busy: boolean;
  currentAssignments: WorkerMeAssignment[];
  onBreakToggle: () => void;
  onClockIn: () => void;
  onClockOut: () => void;
  labels: {
    clockedInSince: string;
    notClockedIn: string;
    onBreakSince: string;
    switchActivity: string;
    chooseActivity: string;
    currentActivity: string;
    endBreak: string;
    startBreak: string;
    working: string;
    stop: string;
    start: string;
  };
}

export function ClockStatusSection({
  clockedIn,
  onBreak,
  status,
  elapsedSeconds,
  masterEngineer,
  activityTypes,
  selectedActivityTypeId,
  onActivityChange,
  onSetActivityTypeId,
  busy,
  currentAssignments,
  onBreakToggle,
  onClockIn,
  onClockOut,
  labels,
}: ClockStatusSectionProps) {
  return (
    <section className="flex flex-col items-center gap-4">
      <p className="text-center text-sm">
        {clockedIn ? (
          <span className="font-medium text-emerald-600">
            {labels.clockedInSince} {formatTime(status?.since)}
          </span>
        ) : (
          <span className="text-muted-foreground">{labels.notClockedIn}</span>
        )}
      </p>

      {clockedIn && onBreak && (
        <p className="text-center text-sm font-medium text-amber-700">
          {labels.onBreakSince} {formatTime(status?.breakStartedAt)}
        </p>
      )}

      {clockedIn && (
        <p className="font-mono text-3xl font-bold tabular-nums">
          {formatDuration(elapsedSeconds)}
        </p>
      )}

      {masterEngineer && activityTypes.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            {clockedIn ? labels.switchActivity : labels.chooseActivity}
          </p>
          {clockedIn && status?.currentActivity && (
            <p className="text-center text-sm font-medium text-emerald-600">
              {labels.currentActivity}: {status.currentActivity.name}
            </p>
          )}
          <Select
            value={selectedActivityTypeId}
            onValueChange={(id) => {
              if (clockedIn) {
                onActivityChange(id);
              } else {
                onSetActivityTypeId(id);
              }
            }}
            disabled={busy || onBreak}
          >
            <SelectTrigger className="min-h-[48px] w-full">
              <SelectValue placeholder={labels.chooseActivity} />
            </SelectTrigger>
            <SelectContent>
              {activityTypes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {clockedIn && (
        <Button
          type="button"
          variant="outline"
          className="min-h-[52px] w-full max-w-sm text-base"
          disabled={busy}
          onClick={onBreakToggle}
        >
          <Coffee className="h-5 w-5" />
          {onBreak ? labels.endBreak : labels.startBreak}
        </Button>
      )}

      <button
        type="button"
        disabled={
          busy ||
          (!clockedIn && currentAssignments.length === 0) ||
          (!clockedIn &&
            masterEngineer &&
            activityTypes.length > 0 &&
            !selectedActivityTypeId)
        }
        onClick={clockedIn ? onClockOut : onClockIn}
        className={cn(
          'flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-lg font-semibold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50',
          clockedIn
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-emerald-600 hover:bg-emerald-700',
        )}
      >
        {clockedIn ? (
          <Square className="h-10 w-10" />
        ) : (
          <Play className="h-10 w-10" />
        )}
        {busy ? labels.working : clockedIn ? labels.stop : labels.start}
      </button>
    </section>
  );
}
