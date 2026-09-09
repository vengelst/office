/**
 * Passport-JWT-Strategy für die Office-API.
 * Extrahiert Bearer-Tokens, prüft die Signatur und validiert bei User-Tokens die Session.
 * Für type=user werden Rollen+Permissions bei jedem Request aus der DB nachgeladen.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '@office/types';
import { PrismaService } from '../../prisma/prisma.service';
import { loadRolesAndPermissionsForUser } from '../permissions.util';

/**
 * Strategie `jwt`: wandelt ein gültiges Access-Token in ein AuthUser-Objekt um.
 * Für Actor-Typ `user` muss zusätzlich eine nicht abgelaufene Session existieren.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * Validiert Payload und Session; Ergebnis landet als `request.user`.
   */
  async validate(req: Request, payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !payload.type) {
      throw new UnauthorizedException('Ungültiges Token');
    }

    if (payload.type === 'user') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      if (token) {
        const session = await this.prisma.session.findFirst({
          where: {
            token,
            userId: payload.sub,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!session) {
          throw new UnauthorizedException('Sitzung abgelaufen oder ungültig');
        }
      }

      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, displayName: true },
      });
      if (!dbUser?.isActive) {
        throw new UnauthorizedException('Benutzer deaktiviert');
      }

      const { roles, permissions } = await loadRolesAndPermissionsForUser(
        this.prisma,
        payload.sub,
      );

      return {
        id: payload.sub,
        type: 'user',
        roles,
        permissions,
        displayName: dbUser.displayName,
      };
    }

    return {
      id: payload.sub,
      type: payload.type,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
