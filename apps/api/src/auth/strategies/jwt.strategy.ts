import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '@office/types';

/**
 * JWT-Strategie: validiert das Bearer-Token und stellt den AuthUser bereit.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'change-me-in-production',
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub || !payload.type) {
      throw new UnauthorizedException('Ungültiges Token');
    }
    return {
      id: payload.sub,
      type: payload.type,
      roles: payload.roles ?? [],
    };
  }
}
