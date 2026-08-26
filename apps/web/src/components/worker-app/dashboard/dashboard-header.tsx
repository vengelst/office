import { MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkerMe } from '@/lib/timesheets';
import { initials } from './helpers';

interface DashboardHeaderProps {
  worker: WorkerMe;
  gpsOk: boolean | null;
  greeting: string;
  gpsActiveLabel: string;
  gpsInactiveLabel: string;
}

export function DashboardHeader({
  worker,
  gpsOk,
  greeting,
  gpsActiveLabel,
  gpsInactiveLabel,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
          {initials(worker.firstName, worker.lastName)}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{greeting}</p>
          <p className="font-semibold leading-tight">
            {worker.firstName} {worker.lastName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1 text-xs',
            gpsOk ? 'text-emerald-600' : 'text-muted-foreground',
          )}
        >
          {gpsOk ? (
            <MapPin className="h-4 w-4" />
          ) : (
            <MapPinOff className="h-4 w-4" />
          )}
          {gpsOk ? gpsActiveLabel : gpsInactiveLabel}
        </span>
      </div>
    </header>
  );
}
