import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '@office/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !payload.type) {
      throw new UnauthorizedException('Ungültiges Token');
    }

    // Worker-Tokens haben keine Session – nur Basis-Validierung
    if (payload.type === 'worker') {
      return {
        id: payload.sub,
        type: payload.type,
        roles: payload.roles ?? [],
      };
    }

    // User-Tokens: prüfe ob Session noch gültig ist
    if (payload.jti) {
      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.jti,
          userId: payload.sub,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!session) {
        throw new UnauthorizedException('Sitzung abgelaufen oder ungültig');
      }
    }

    return {
      id: payload.sub,
      type: payload.type,
      roles: payload.roles ?? [],
    };
  }
}
