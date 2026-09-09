/**
 * Prüft @RequirePermission(...) gegen request.user.permissions.
 * SUPERADMIN-Rolle hat immer Zugriff.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@office/types';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { userHasPermission } from '../permissions.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Keine Berechtigung');
    }
    if (!userHasPermission(user.roles, user.permissions, required)) {
      throw new ForbiddenException('Unzureichende Berechtigung');
    }
    return true;
  }
}
