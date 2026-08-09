/**
 * Gemeinsame Typen, Selects und Helfer für Projects.
 */

import { Prisma } from '@prisma/client';

/** Sortierbare Spalten der Projektliste. */
export const SORTABLE_FIELDS = [
  'projectNumber',
  'title',
  'status',
  'priority',
  'plannedStartDate',
  'createdAt',
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

export interface ListProjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  serviceType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Schlanke Projektion für die Listenansicht. */
export const listSelect = {
  id: true,
  projectNumber: true,
  title: true,
  status: true,
  priority: true,
  serviceType: true,
  plannedStartDate: true,
  plannedEndDate: true,
  actualStartDate: true,
  actualEndDate: true,
  customer: { select: { id: true, companyName: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.ProjectSelect;

/** Vollständige Projektion für die Detailansicht. */
export const detailInclude = {
  customer: { select: { id: true, companyName: true, customerNumber: true } },
  branch: { select: { id: true, name: true } },
  internalProjectManager: { select: { id: true, displayName: true } },
  primaryCustomerContact: {
    select: { id: true, firstName: true, lastName: true },
  },
  sites: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  equipment: { orderBy: { issuedAt: 'desc' } },
  emailRecipients: { orderBy: { recipientType: 'asc' } },
  assignments: {
    orderBy: [{ isLead: 'desc' }, { startDate: 'asc' }],
    include: {
      worker: {
        select: { id: true, workerNumber: true, firstName: true, lastName: true },
      },
    },
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    include: { changedBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.ProjectInclude;

/** Datumsfelder im DTO von ISO-Strings nach Date konvertieren. */
export function coerceDate(value?: string): Date | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

