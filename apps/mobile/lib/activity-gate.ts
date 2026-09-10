/**
 * Gate für Tätigkeits-Select / Mid-Day-Wechsel (#34).
 * Master immer; Normal bei HOURLY_PACKAGE und MIXED
 * (gemischte Projekte: Stundenanteil braucht Tätigkeiten).
 * Spiegel von apps/web/src/lib/activity-gate.ts.
 */

export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: string | null | undefined,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE' || billingMode === 'MIXED';
}
