/**
 * Pausen-/Brutto-/Netto-Berechnung für Stempeluhr und Stundenzettel.
 */

import { BreakRule, TimeEntryType } from '@prisma/client';
import { computeBreakMinutes } from '../timesheets/timesheet.util';

export type StempelEvent = {
  entryType: TimeEntryType;
  occurredAtClient: Date;
  projectId?: string | null;
};

/** Summe Pause-Minuten aus BREAK_START/BREAK_END-Paaren (offen → bis `until`). */
export function bookedBreakMinutes(
  events: StempelEvent[],
  until: Date = new Date(),
): number {
  let total = 0;
  let breakStart: Date | null = null;
  const sorted = [...events].sort(
    (a, b) => a.occurredAtClient.getTime() - b.occurredAtClient.getTime(),
  );
  for (const e of sorted) {
    if (e.entryType === TimeEntryType.BREAK_START) {
      breakStart = e.occurredAtClient;
    } else if (e.entryType === TimeEntryType.BREAK_END && breakStart) {
      total += Math.max(
        0,
        Math.round((e.occurredAtClient.getTime() - breakStart.getTime()) / 60_000),
      );
      breakStart = null;
    } else if (e.entryType === TimeEntryType.CLOCK_OUT && breakStart) {
      total += Math.max(
        0,
        Math.round((e.occurredAtClient.getTime() - breakStart.getTime()) / 60_000),
      );
      breakStart = null;
    }
  }
  if (breakStart) {
    total += Math.max(
      0,
      Math.round((until.getTime() - breakStart.getTime()) / 60_000),
    );
  }
  return total;
}

/** Brutto aus CLOCK_IN/OUT-Paaren (offenes IN → until). */
export function grossMinutesFromClocks(
  events: StempelEvent[],
  until: Date = new Date(),
): number {
  let total = 0;
  let openIn: Date | null = null;
  const sorted = [...events].sort(
    (a, b) => a.occurredAtClient.getTime() - b.occurredAtClient.getTime(),
  );
  for (const e of sorted) {
    if (e.entryType === TimeEntryType.CLOCK_IN) {
      openIn = e.occurredAtClient;
    } else if (e.entryType === TimeEntryType.CLOCK_OUT && openIn) {
      total += Math.max(
        0,
        Math.round((e.occurredAtClient.getTime() - openIn.getTime()) / 60_000),
      );
      openIn = null;
    }
  }
  if (openIn) {
    total += Math.max(
      0,
      Math.round((until.getTime() - openIn.getTime()) / 60_000),
    );
  }
  return total;
}

/**
 * Effektive Pause: gebuchte Pause wenn Events vorhanden, sonst BreakRule-Fallback.
 */
export function effectiveBreakMinutes(
  events: StempelEvent[],
  grossMinutes: number,
  rule: BreakRule | null,
  until?: Date,
): { booked: number; rule: number; effective: number; usedFallback: boolean } {
  const booked = bookedBreakMinutes(events, until);
  const ruleMins = computeBreakMinutes(grossMinutes, rule);
  const hasBreakEvents = events.some(
    (e) =>
      e.entryType === TimeEntryType.BREAK_START ||
      e.entryType === TimeEntryType.BREAK_END,
  );
  if (hasBreakEvents) {
    return { booked, rule: ruleMins, effective: booked, usedFallback: false };
  }
  return {
    booked: 0,
    rule: ruleMins,
    effective: ruleMins,
    usedFallback: ruleMins > 0,
  };
}

function berlinLocalToUtcMs(dateStr: string, h: number, m: number, s: number): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  let guess = Date.UTC(y, mo - 1, d, h - 2, m, s);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const got = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    const want = Date.UTC(y, mo - 1, d, h, m, s);
    guess += want - got;
  }
  return guess;
}

/** Tagesgrenzen Europe/Berlin für YYYY-MM-DD. */
export function berlinDayRange(dateStr: string): { from: Date; to: Date } {
  const startMs = berlinLocalToUtcMs(dateStr, 0, 0, 0);
  const endMs = berlinLocalToUtcMs(dateStr, 23, 59, 59) + 999;
  return { from: new Date(startMs), to: new Date(endMs) };
}

/** ISO-KW (Mo–So) als Berlin-Tagesgrenzen. */
export function isoWeekRangeBerlin(
  weekYear: number,
  weekNumber: number,
): { from: Date; to: Date; fromDate: string; toDate: string } {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(week1Mon);
  monday.setUTCDate(week1Mon.getUTCDate() + (weekNumber - 1) * 7);
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  };
  const fromDate = fmt(monday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const toDate = fmt(sunday);
  const { from } = berlinDayRange(fromDate);
  const { to } = berlinDayRange(toDate);
  return { from, to, fromDate, toDate };
}

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
