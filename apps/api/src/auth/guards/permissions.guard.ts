/**
 * Permissions-Guard: prüft, ob der Authentifizierte eine der geforderten Permissions besitzt.
 * SUPERADMIN-Rolle gilt als Vollzugriff.
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

/**
 * Prüft @RequirePermission() gegen die Permissions am AuthUser.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Entscheidet, ob die aktuelle Route freigegeben wird.
   */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Keine Berechtigung');
    }

    if (user.roles?.includes('SUPERADMIN')) {
      return true;
    }

    const perms = user.permissions ?? [];
    const ok = required.some((code) => perms.includes(code));
    if (!ok) {
      throw new ForbiddenException('Unzureichende Berechtigung');
    }

    return true;
  }
}
