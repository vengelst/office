/**
 * Gemeinsame Typen, Selects und Helfer für Timesheets.
 */

import {
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  RoleCode,
  WeeklyTimesheetStatus,
} from '@prisma/client';

/** Sortierbare Spalten der Stundenzettel-Liste. */
export const SORTABLE_FIELDS = [
  'weekYear',
  'weekNumber',
  'status',
  'generatedAt',
  'totalMinutesNet',
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

/** Interne Rollen – sie sehen und bearbeiten alle Stundenzettel wie bisher. */
export const INTERNAL_ROLES: string[] = [
  RoleCode.SUPERADMIN,
  RoleCode.OFFICE,
  RoleCode.PROJECT_MANAGER,
];

/** Status, in denen der Stundenzettel editiert/neu generiert werden darf. */
export const EDITABLE_STATUSES: WeeklyTimesheetStatus[] = [
  WeeklyTimesheetStatus.DRAFT,
  WeeklyTimesheetStatus.REJECTED,
];

/** Status, in denen keine Unterschrift mehr hinzugefügt werden darf. */
export const FINAL_STATUSES: WeeklyTimesheetStatus[] = [
  WeeklyTimesheetStatus.APPROVED,
  WeeklyTimesheetStatus.COMPLETED,
  WeeklyTimesheetStatus.LOCKED,
  WeeklyTimesheetStatus.ARCHIVED,
];

export const listSelect = {
  id: true,
  weekYear: true,
  weekNumber: true,
  status: true,
  totalMinutesGross: true,
  totalBreakMinutes: true,
  totalMinutesNet: true,
  generatedAt: true,
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  worker: {
    select: { id: true, workerNumber: true, firstName: true, lastName: true },
  },
  project: { select: { id: true, projectNumber: true, title: true } },
} satisfies Prisma.WeeklyTimesheetSelect;

export const detailInclude = {
  worker: {
    select: {
      id: true,
      workerNumber: true,
      firstName: true,
      lastName: true,
      photoPath: true,
    },
  },
  project: {
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: { select: { id: true, companyName: true } },
    },
  },
  reviewedBy: { select: { id: true, displayName: true } },
  approvedBy: { select: { id: true, displayName: true } },
  days: { orderBy: { workDate: 'asc' } },
  signatures: { orderBy: { signedAt: 'asc' } },
} satisfies Prisma.WeeklyTimesheetInclude;

export interface ListTimesheetsParams {
  page?: number;
  limit?: number;
  workerId?: string;
  projectId?: string;
  weekYear?: number;
  weekNumber?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface DayAggregate {
  workDate: Date;
  firstClockInAt: Date | null;
  lastClockOutAt: Date | null;
  grossMinutes: number;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
}

export interface SignatureMeta {
  ipAddress?: string;
  deviceInfo?: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────

export function sumTotals(
  days: Array<{
    grossMinutes: number | null;
    breakMinutes: number | null;
    netMinutes: number | null;
  }>,
): { gross: number; break: number; net: number } {
  return days.reduce(
    (acc, d) => ({
      gross: acc.gross + (d.grossMinutes ?? 0),
      break: acc.break + (d.breakMinutes ?? 0),
      net: acc.net + (d.netMinutes ?? 0),
    }),
    { gross: 0, break: 0, net: 0 },
  );
}

export function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Ungültiges Datum: ${value}`);
  }
  return d;
}

/** Dekodiert eine Base64-PNG (Data-URL oder reiner Base64-String) zu Buffer. */
export function decodeBase64Png(input: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/.exec(input.trim());
  const base64 = match ? match[1] : input.trim();
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new BadRequestException('Ungültige Base64-Signatur');
  }
}
