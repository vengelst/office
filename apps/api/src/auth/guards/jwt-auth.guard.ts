/**
 * Globaler JWT-Auth-Guard für die Office-API.
 * Routen mit @Public() werden ohne Token-Prüfung durchgelassen.
 */

import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Globaler JWT-Guard. Routes mit @Public() werden übersprungen.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Entscheidet, ob die aktuelle Route freigegeben wird.
   *
   * @param context - Nest ExecutionContext (ExecutionContext)
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
