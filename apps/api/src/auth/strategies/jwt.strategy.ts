/**
 * Passport-JWT-Strategy für die Office-API.
 * Extrahiert Bearer-Tokens, prüft die Signatur und validiert bei User-Tokens die Session.
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
   *
   * @param req - HTTP-Request (für Authorization-Header / Session-Lookup)
   * @param payload - Dekodiertes JWT-Payload
   * @returns AuthUser für Guards und `@CurrentUser()`
   * @throws {UnauthorizedException} Bei ungültigem Payload oder fehlender Session
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
      const fresh = await loadRolesAndPermissionsForUser(
        this.prisma,
        payload.sub,
      );
      if (!fresh.roles.length) {
        throw new UnauthorizedException('Benutzer inaktiv oder nicht gefunden');
      }
      return {
        id: payload.sub,
        type: 'user',
        roles: fresh.roles,
        permissions: fresh.permissions,
        displayName: fresh.displayName,
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
