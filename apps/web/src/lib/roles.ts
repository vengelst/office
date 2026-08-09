/**
 * Rollen-Helfer für die Web-Oberfläche.
 *
 * Der Kunden-PL (`CUSTOMER_PL`) ist eine eigene Rolle und hat nichts mit den
 * internen Rollen zu tun (SPEZ-arbeitsitems.md 4.2). Ein Benutzer, der *nur*
 * diese Rolle besitzt, sieht eine stark reduzierte Oberfläche unter `/pl`.
 * Die verbindliche Absicherung liegt in der API – hier geht es um Navigation
 * und darum, Aktionen gar nicht erst anzubieten.
 */
import type { AuthUser } from '@office/types';

/** Interne Office-Rollen (Vollzugriff auf die bestehende Oberfläche). */
export const INTERNAL_ROLES = [
  'SUPERADMIN',
  'OFFICE',
  'PROJECT_MANAGER',
] as const;

/** Rolle des Kunden-Projektleiters. */
export const CUSTOMER_PL_ROLE = 'CUSTOMER_PL';

/** Startseite eines reinen Kunden-PLs nach dem Login. */
export const CUSTOMER_PL_HOME = '/pl';

/**
 * True, wenn der Benutzer mindestens eine interne Rolle hat.
 *
 * @param user - Parameter `user` (AuthUser | null | undefined)
 * @returns boolean
 */
export function hasInternalRole(user: AuthUser | null | undefined): boolean {
  return Boolean(
    user?.roles?.some((role) => (INTERNAL_ROLES as readonly string[]).includes(role)),
  );
}

/**
 * True, wenn der Benutzer die Rolle CUSTOMER_PL besitzt.
 *
 * @param user - Parameter `user` (AuthUser | null | undefined)
 * @returns boolean
 */
export function isCustomerPl(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.includes(CUSTOMER_PL_ROLE));
}

/**
 * True, wenn der Benutzer ausschließlich Kunden-PL ist – dann gilt die
/**
 * reduzierte Navigation und der Zugriff bleibt auf `/pl/**` beschränkt. /.
 *
 * @param user - Parameter `user` (AuthUser | null | undefined)
 * @returns boolean
 */
export function isCustomerPlOnly(user: AuthUser | null | undefined): boolean {
  return isCustomerPl(user) && !hasInternalRole(user);
}

/**
 * Startroute nach dem Login je nach Rolle.
 *
 * @param user - Parameter `user` (AuthUser | null | undefined)
 * @returns string
 */
export function homeRouteFor(user: AuthUser | null | undefined): string {
  return isCustomerPlOnly(user) ? CUSTOMER_PL_HOME : '/dashboard';
}

/**
 * True, wenn der Pfad zum Kunden-PL-Bereich gehört.
 *
 * @param pathname - Parameter `pathname` (string)
 * @returns boolean
 */
export function isCustomerPlRoute(pathname: string): boolean {
  return pathname === CUSTOMER_PL_HOME || pathname.startsWith(`${CUSTOMER_PL_HOME}/`);
}
