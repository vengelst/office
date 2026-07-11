import { randomUUID } from 'node:crypto';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  ActorType,
  AuthUser,
  JwtPayload,
  LoginResponse,
} from '@office/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service für Authentifizierung und Session-Management.
 * Unterstützt Login via E-Mail/Passwort (Office-Benutzer) und PIN (Monteure).
 * Erstellt JWTs und verwaltet aktive Sessions in der Datenbank.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** E-Mail + Passwort → JWT für einen Office-Benutzer. */
  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const authUser: AuthUser = {
      id: user.id,
      type: 'user',
      roles,
      displayName: user.displayName,
    };

    return this.issueToken(authUser);
  }

  /** Worker-PIN → JWT für einen Monteur (type: 'worker'). */
  async pinLogin(pin: string): Promise<LoginResponse> {
    const now = new Date();
    const activePins = await this.prisma.workerPin.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      include: { worker: true },
    });

    for (const workerPin of activePins) {
      if (!workerPin.worker.active) {
        continue;
      }
      const match = await bcrypt.compare(pin, workerPin.pinHash);
      if (match) {
        const authUser: AuthUser = {
          id: workerPin.worker.id,
          type: 'worker',
          roles: ['WORKER'],
          displayName: `${workerPin.worker.firstName} ${workerPin.worker.lastName}`,
        };
        return this.issueToken(authUser);
      }
    }

    throw new UnauthorizedException('Ungültige PIN');
  }

  /** Invalidiert die Session anhand des übergebenen Tokens. */
  async logout(token: string): Promise<{ success: true }> {
    await this.prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }

  /** Erneuert das Token eines bereits authentifizierten Akteurs. */
  async refresh(user: AuthUser): Promise<LoginResponse> {
    return this.issueToken(user);
  }

  /** Erstellt ein JWT und persistiert eine Session (nur für Office-User). */
  private async issueToken(user: AuthUser): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      type: user.type as ActorType,
      roles: user.roles,
    };

    // Eindeutige jti, damit aufeinanderfolgende Tokens (z.B. Login + Refresh
    // innerhalb derselben Sekunde) sich garantiert unterscheiden.
    const accessToken = await this.jwtService.signAsync(payload, {
      jwtid: randomUUID(),
    });

    if (user.type === 'user') {
      const expiresAt = this.computeExpiry();
      await this.prisma.session.upsert({
        where: { token: accessToken },
        update: { expiresAt },
        create: { userId: user.id, token: accessToken, expiresAt },
      });
    }

    return { accessToken, user };
  }

  /** Berechnet das Ablaufdatum aus JWT_EXPIRES_IN (unterstützt z.B. "8h", "30m", "7d"). */
  private computeExpiry(): Date {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN') ?? '8h';
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    const now = Date.now();
    if (!match) {
      return new Date(now + 8 * 60 * 60 * 1000);
    }
    const value = Number(match[1]);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(now + value * unitMs[match[2]]);
  }
}
