import { texts } from '@/lib/texts';
import { DAY_KEYS } from './constants';

export function weekdayLabel(iso: string): string {
  const d = new Date(iso);
  const key = DAY_KEYS[d.getDay()];
  return texts.timesheets.days[key];
}

/** ISO-String → Wert für <input type="datetime-local"> (lokal). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
