import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
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
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

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
    }

    return {
      id: payload.sub,
      type: payload.type,
      roles: payload.roles ?? [],
    };
  }
}
