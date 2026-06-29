import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@office/types';

/**
 * Liefert den authentifizierten Benutzer (aus dem JWT) im Controller.
 * Nutzung: `@CurrentUser() user: AuthUser`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
