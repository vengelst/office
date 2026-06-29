import { SetMetadata } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Beschränkt eine Route auf die angegebenen Rollen.
 * Wird vom RolesGuard gegen die JWT-Rollen geprüft.
 */
export const Roles = (...roles: RoleCode[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
