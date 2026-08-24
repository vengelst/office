/**
 * Authentifizierung für Office-Benutzer und Monteure.
 * Login (E-Mail/Passwort, PIN), JWT-Ausstellung und Session-Verwaltung.
 */

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

  /**
   * E-Mail + Passwort → JWT für einen Office-Benutzer.
   *
   * @param email - E-Mail-Adresse (string)
   * @param password - Klartext-Passwort (wird gehasht geprüft) (string)
   * @returns LoginResponse mit Token und Benutzer (LoginResponse)
   * @throws {UnauthorizedException} Bei fehlender oder ungültiger Authentifizierung
   */
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

  /**
   * Worker-PIN → JWT für einen Monteur (type: 'worker').
   *
   * @param pin - PIN-Code (Klartext, Abgleich gegen Hash) (string)
   * @returns LoginResponse (LoginResponse)
   * @throws {UnauthorizedException} Bei fehlender oder ungültiger Authentifizierung
   */
  async pinLogin(
    pin: string,
    source: 'kiosk' | 'app' = 'app',
  ): Promise<LoginResponse> {
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
        if (source === 'kiosk' && !workerPin.worker.kioskAccessEnabled) {
          throw new UnauthorizedException(
            'Kiosk-Zugang für diesen Monteur ist deaktiviert',
          );
        }
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

  /**
   * User-PIN → JWT für einen Benutzer (type: 'user', mind. CUSTOMER_PL).
   *
   * @param pin - PIN-Code (Klartext, Abgleich gegen Hash) (string)
   * @returns LoginResponse (LoginResponse)
   * @throws {UnauthorizedException} Bei fehlender oder ungültiger Authentifizierung
   */
  async userPinLogin(pin: string): Promise<LoginResponse> {
    const now = new Date();
    const activePins = await this.prisma.userPin.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    for (const userPin of activePins) {
      if (!userPin.user.isActive) continue;
      const match = await bcrypt.compare(pin, userPin.pinHash);
      if (match) {
        const roles = userPin.user.roles.map((ur) => ur.role.code);
        if (!roles.includes('CUSTOMER_PL')) {
          throw new UnauthorizedException(
            'Nur Benutzer mit Rolle CUSTOMER_PL können sich per PIN anmelden',
          );
        }
        const authUser: AuthUser = {
          id: userPin.user.id,
          type: 'user',
          roles,
          displayName: userPin.user.displayName,
        };
        return this.issueToken(authUser);
      }
    }

    throw new UnauthorizedException('Ungültige PIN');
  }

  /**
   * Invalidiert die Session anhand des übergebenen Tokens.
   *
   * @param token - JWT bzw. Session-Token (string)
   * @returns Erfolgsbestätigung
   */
  async logout(token: string): Promise<{ success: true }> {
    await this.prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }

  /**
   * Erneuert das Token eines bereits authentifizierten Akteurs.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns LoginResponse mit neuem Token (LoginResponse)
   */
  async refresh(user: AuthUser): Promise<LoginResponse> {
    return this.issueToken(user);
  }

  /**
   * Erstellt ein JWT und persistiert eine Session (nur für Office-User).
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns LoginResponse (LoginResponse)
   */
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

  /**
   * Berechnet das Ablaufdatum aus JWT_EXPIRES_IN (unterstützt z.B. "8h", "30m", "7d").
   *
   * @returns Date (Date)
   */
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
