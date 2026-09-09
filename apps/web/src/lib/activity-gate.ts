/**
 * Gate für Tätigkeits-Select / Mid-Day-Wechsel (#34).
 * Master immer; Normal nur bei HOURLY_PACKAGE.
 */

export type BillingModeLike =
  | 'HOURLY_PACKAGE'
  | 'UNIT_BASED'
  | 'MIXED'
  | string
  | null
  | undefined;

export function isActivityTrackingRequired(
  masterEngineer: boolean,
  billingMode: BillingModeLike,
): boolean {
  if (masterEngineer) return true;
  return billingMode === 'HOURLY_PACKAGE';
}

function firstBillingMode(
  ...values: BillingModeLike[]
): string | null {
  for (const v of values) {
    if (v != null && v !== '') return v;
  }
  return null;
}

/**
 * billingMode-Quellen für Kiosk/Monteur-App.
 * Eingestempelt: Status → Assignment → Kiosk-Config.
 * Nicht eingestempelt: Assignment → Kiosk-Config.
 * Leere/null-Werte gelten als fehlend und fallen durch.
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
