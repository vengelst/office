/**
 * Gate für abrechnungsrelevante Tätigkeitssegmente (#22 / #34).
 *
 * Master immer; Normal-Monteure nur bei stundenbasiertem Projekt.
 */

export type BillingModeLike = 'HOURLY_PACKAGE' | 'UNIT_BASED' | 'MIXED' | string | null | undefined;

/** Tätigkeitspflicht / Mid-Day-Wechsel erlaubt? */
export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: BillingModeLike,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE';
}
