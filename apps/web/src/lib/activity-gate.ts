/**
 * Gate für Tätigkeits-Select / Mid-Day-Wechsel (#34).
 * Master immer; Normal nur bei HOURLY_PACKAGE.
 */

export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: string | null | undefined,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE';
}
