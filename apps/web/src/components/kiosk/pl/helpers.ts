import { texts } from '@/lib/texts';

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function weekdayLabel(iso: string): string {
  return texts.timesheets.days[DAY_KEYS[new Date(iso).getDay()]];
}
