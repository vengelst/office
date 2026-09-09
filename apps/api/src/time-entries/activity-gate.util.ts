/**
 * Gate für abrechnungsrelevante Tätigkeitssegmente (#22 / #34).
 *
 * Master immer; Normal-Monteure nur bei stundenbasiertem Projekt.
 */

export type BillingModeLike =
  | 'HOURLY_PACKAGE'
  | 'UNIT_BASED'
  | 'MIXED'
  | string
  | null
  | undefined;

/** Tätigkeitspflicht / Mid-Day-Wechsel erlaubt? */
export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: BillingModeLike,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE';
}

function firstBillingMode(...values: BillingModeLike[]): string | null {
  for (const v of values) {
    if (v != null && v !== '') return v;
  }
  return null;
}

/**
 * billingMode-Quellen (Priorität).
 * Eingestempelt: Status → Assignment → Config.
 * Sonst: Assignment → Config. Leere/null = fehlend → Fallback.
 */
export function resolveActivityBillingMode(params: {
  clockedIn?: boolean;
  statusBillingMode?: BillingModeLike;
  assignmentBillingMode?: BillingModeLike;
  configBillingMode?: BillingModeLike;
}): string | null {
  if (params.clockedIn) {
    return firstBillingMode(
      params.statusBillingMode,
      params.assignmentBillingMode,
      params.configBillingMode,
    );
  }
  return firstBillingMode(
    params.assignmentBillingMode,
    params.configBillingMode,
  );
}
