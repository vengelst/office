/**
 * Gate für Tätigkeits-Select / Mid-Day-Wechsel (#34).
 * Master immer; Normal nur bei HOURLY_PACKAGE.
 * Spiegel von apps/web/src/lib/activity-gate.ts.
 */

export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: string | null | undefined,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE';
}
