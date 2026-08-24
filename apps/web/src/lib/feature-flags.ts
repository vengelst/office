/**
 * Client-API und Typen für Feature-Flags (Office-Web).
 */

import { apiClient } from './api-client';

export const DEFAULT_FEATURE_FLAGS = {
  customers: true,
  projects: true,
  workers: true,
  teams: true,
  subcontractors: true,
  vehicles: true,
  equipment: true,
  timeClock: true,
  timesheets: true,
  documents: true,
  invoices: true,
  todos: true,
  calendar: true,
} as const;

export type FeatureFlagKey = keyof typeof DEFAULT_FEATURE_FLAGS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Nav-Href → Feature-Flag. */
export const NAV_HREF_TO_FEATURE: Partial<Record<string, FeatureFlagKey>> = {
  '/customers': 'customers',
  '/projects': 'projects',
  '/workers': 'workers',
  '/teams': 'teams',
  '/subcontractors': 'subcontractors',
  '/vehicles': 'vehicles',
  '/equipment': 'equipment',
  '/time-clock': 'timeClock',
  '/timesheets': 'timesheets',
  '/documents': 'documents',
  '/invoices': 'invoices',
  '/todos': 'todos',
  '/calendar': 'calendar',
};

export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  customers: 'Kunden',
  projects: 'Projekte',
  workers: 'Monteure',
  teams: 'Teams',
  subcontractors: 'Subunternehmen',
  vehicles: 'Fahrzeuge',
  equipment: 'Werkzeuge & Geräte',
  timeClock: 'Stempeluhr',
  timesheets: 'Stundenzettel',
  documents: 'Dokumente',
  invoices: 'Rechnungen',
  todos: 'To-Dos',
  calendar: 'Termine',
};

export const featureFlagsApi = {
  get: () => apiClient.get<FeatureFlags>('/feature-flags'),
  put: (flags: Partial<FeatureFlags>) =>
    apiClient.put<FeatureFlags>('/feature-flags', flags),
};
