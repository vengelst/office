import { redirect } from 'next/navigation';

/** "Stempeluhr" leitet auf die Live-Übersicht weiter. */
export default function TimeClockIndexPage(): never {
  redirect('/time-clock/live');
}
