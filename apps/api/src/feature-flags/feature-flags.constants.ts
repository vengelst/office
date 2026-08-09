/**
 * Feature-Flag-Defaults und Typen (Office-API).
 * Fehlende Keys gelten als aktiviert (true).
 */

export const FEATURE_FLAGS_KEY = 'feature_flags';

/** Bekannte Kernmodul-Flags – Defaults alle true. */
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
} as const;

export type FeatureFlagKey = keyof typeof DEFAULT_FEATURE_FLAGS;

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Merged Defaults mit gespeicherten Werten; unbekannte Keys werden ignoriert. */
export function mergeFeatureFlags(
  stored: Partial<Record<string, boolean>> | null | undefined,
): FeatureFlags {
  const result = { ...DEFAULT_FEATURE_FLAGS } as FeatureFlags;
  if (!stored || typeof stored !== 'object') return result;
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]) {
    if (typeof stored[key] === 'boolean') {
      result[key] = stored[key] as boolean;
    }
  }
  return result;
}

/** Nav-Href → Feature-Flag (nur Kernmodule). */
export const NAV_HREF_TO_FEATURE: Record<string, FeatureFlagKey> = {
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
};
