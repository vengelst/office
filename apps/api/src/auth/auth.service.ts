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
import { PinLengthService } from '../app-settings/pin-length.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  loadPermissionsForUser,
  loadRolesAndPermissionsForUser,
} from './permissions.util';

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
    private readonly pinLength: PinLengthService,
  ) {}

  /**
   * E-Mail + Passwort → JWT für einen Office-Benutzer.
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
    const permissions = await loadPermissionsForUser(this.prisma, user.id);
    const authUser: AuthUser = {
      id: user.id,
      type: 'user',
      roles,
      permissions,
      displayName: user.displayName,
    };

    return this.issueToken(authUser);
  }

  /**
   * Worker-PIN → JWT für einen Monteur (type: 'worker').
   * Permissions bewusst leer – Zugang steuern die Worker-Guards/Rollen.
   */
  async pinLogin(
    pin: string,
    source: 'kiosk' | 'app' = 'app',
  ): Promise<LoginResponse> {
    if (!(await this.pinLength.matchesConfiguredLength(pin))) {
      throw new UnauthorizedException('Ungültige PIN');
    }
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
          permissions: [],
          displayName: `${workerPin.worker.firstName} ${workerPin.worker.lastName}`,
        };
        return this.issueToken(authUser);
      }
    }

    throw new UnauthorizedException('Ungültige PIN');
  }

  /**
   * User-PIN → JWT für einen Benutzer (type: 'user', mind. CUSTOMER_PL).
   */
  async userPinLogin(pin: string): Promise<LoginResponse> {
    if (!(await this.pinLength.matchesConfiguredLength(pin))) {
      throw new UnauthorizedException('Ungültige PIN');
    }
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
        const permissions = await loadPermissionsForUser(
          this.prisma,
          userPin.user.id,
        );
        const authUser: AuthUser = {
          id: userPin.user.id,
          type: 'user',
          roles,
          permissions,
          displayName: userPin.user.displayName,
        };
        return this.issueToken(authUser);
      }
    }

    throw new UnauthorizedException('Ungültige PIN');
  }

  /**
   * Invalidiert die Session anhand des übergebenen Tokens.
   */
  async logout(token: string): Promise<{ success: true }> {
    await this.prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }

  /**
   * Erneuert das Token. Für type=user werden Rollen+Permissions frisch aus der DB geladen.
   */
  async refresh(user: AuthUser): Promise<LoginResponse> {
    if (user.type === 'user') {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true, displayName: true },
      });
      if (!dbUser?.isActive) {
        throw new UnauthorizedException('Benutzer deaktiviert');
      }
      const { roles, permissions } = await loadRolesAndPermissionsForUser(
        this.prisma,
        user.id,
      );
      return this.issueToken({
        id: user.id,
        type: 'user',
        roles,
        permissions,
        displayName: dbUser.displayName,
      });
    }

    return this.issueToken({
      ...user,
      permissions: user.permissions ?? [],
    });
  }

  /**
   * Aktueller Benutzer mit frischen Rollen+Permissions aus der DB (nur type=user).
   */
  async me(user: AuthUser): Promise<AuthUser> {
    if (user.type !== 'user') {
      return {
        id: user.id,
        type: user.type,
        roles: user.roles,
        permissions: user.permissions ?? [],
        displayName: user.displayName,
      };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true, displayName: true },
    });
    if (!dbUser?.isActive) {
      throw new UnauthorizedException('Benutzer deaktiviert');
    }
    const { roles, permissions } = await loadRolesAndPermissionsForUser(
      this.prisma,
      user.id,
    );
    return {
      id: user.id,
      type: 'user',
      roles,
      permissions,
      displayName: dbUser.displayName,
    };
  }

  /**
   * Erstellt ein JWT und persistiert eine Session (nur für Office-User).
   */
  private async issueToken(user: AuthUser): Promise<LoginResponse> {
    const permissions = user.permissions ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      type: user.type as ActorType,
      roles: user.roles,
      permissions,
    };

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

    const authUser: AuthUser = {
      id: user.id,
      type: user.type,
      roles: user.roles,
      permissions,
      displayName: user.displayName,
    };

    return { accessToken, user: authUser };
  }

  /**
   * Berechnet das Ablaufdatum aus JWT_EXPIRES_IN (unterstützt z.B. "8h", "30m", "7d").
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
