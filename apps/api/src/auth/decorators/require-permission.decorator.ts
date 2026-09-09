/**
 * Decorator `@RequirePermission(...)`: deklariert erforderliche Permission-Codes.
 * PermissionsGuard prüft OR der Codes; SUPERADMIN hat Bypass.
 */

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Beschränkt eine Route auf mindestens eine der angegebenen Permissions.
 *
 * @param codes - Erforderliche Permission-Codes (OR)
 */
export const RequirePermission = (
  ...codes: string[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, codes);
