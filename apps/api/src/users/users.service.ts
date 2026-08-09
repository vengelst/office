/**
 * Service für Users.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

/** Öffentliche Benutzerdarstellung ohne Passwort-Hash. */
const userSelect = {
  id: true,
  email: true,
  displayName: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { code: true, name: true } } } },
} satisfies Prisma.UserSelect;

/**
 * Service für die Benutzerverwaltung (Office-Benutzer).
 * Behandelt CRUD mit Rollen-Zuordnung, Passwort-Hashing
 * und Benutzer-Deaktivierung (Soft-Disable).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert alle Benutzer (ohne Passwort-Hash), sortiert nach Erstellungsdatum.
   *
   * @returns Array aller Benutzer mit Rollen
   */
  findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Liefert einen einzelnen Benutzer mit Rollen.
   *
   * @param id - UUID des Benutzers
   * @returns Benutzerdaten ohne Passwort-Hash
   * @throws NotFoundException wenn der Benutzer nicht existiert
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }
    return user;
  }

  /**
   * Erstellt einen neuen Benutzer mit gehashtem Passwort und Rollenzuordnung.
   * Prüft Eindeutigkeit der E-Mail-Adresse.
   *
   * @param dto - Benutzerdaten (E-Mail, Passwort, Name, Rollen)
   * @returns Der erstellte Benutzer
   * @throws ConflictException wenn die E-Mail bereits vergeben ist
   */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-Mail-Adresse bereits vergeben');
    }

    const roleIds = await this.resolveRoleIds(dto.roles);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        notes: dto.notes,
        roles: {
          create: roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: userSelect,
    });
  }

  /**
   * Aktualisiert einen bestehenden Benutzer.
   * Bei Rollen-Änderung werden alle alten Zuordnungen ersetzt.
   * Bei Passwort-Änderung wird der neue Hash generiert.
   *
   * @param id - UUID des Benutzers
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Benutzer
   */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    if (dto.roles !== undefined) {
      const roleIds = await this.resolveRoleIds(dto.roles);
      data.roles = {
        deleteMany: {},
        create: roleIds.map((roleId) => ({ roleId })),
      };
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  /**
   * Deaktiviert den Benutzer (Soft-Disable statt Löschen).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Deaktivierter Datensatz
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });
  }

  /**
   * Setzt eine 6-stellige PIN für einen CUSTOMER_PL-Benutzer. PINs müssen global eindeutig sein (über WorkerPin und UserPin).
   *
   * @param userId - ID (userId) (string)
   * @param pin - PIN-Code (Klartext, Abgleich gegen Hash) (string)
   * @returns Ergebnis
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  async setPin(userId: string, pin: string): Promise<{ success: true }> {
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN muss genau 6 Ziffern sein.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    const hasCustomerPl = user.roles.some((ur) => ur.role.code === 'CUSTOMER_PL');
    if (!hasCustomerPl) {
      throw new BadRequestException(
        'PIN kann nur für Benutzer mit Rolle CUSTOMER_PL gesetzt werden.',
      );
    }

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

    // Global uniqueness: check against all active WorkerPins and UserPins
    const now = new Date();
    const activeWorkerPins = await this.prisma.workerPin.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      select: { pinHash: true },
    });
    const activeUserPins = await this.prisma.userPin.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
        userId: { not: userId },
      },
      select: { pinHash: true },
    });

    for (const existing of [...activeWorkerPins, ...activeUserPins]) {
      const collision = await bcrypt.compare(pin, existing.pinHash);
      if (collision) {
        throw new ConflictException(
          'Diese PIN ist bereits vergeben. Bitte eine andere wählen.',
        );
      }
    }

    await this.prisma.userPin.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, validTo: now },
    });

    await this.prisma.userPin.create({
      data: { userId, pinHash, validFrom: now, isActive: true },
    });

    return { success: true };
  }

  /**
   * Löst Rollen-Codes in Datenbank-IDs auf. Wirft Fehler bei unbekannten Codes.
   *
   * @param codes - Parameter `codes` (RoleCode[])
   * @returns string[]
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async resolveRoleIds(codes: RoleCode[]): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    if (roles.length !== codes.length) {
      throw new NotFoundException('Mindestens eine Rolle existiert nicht');
    }
    return roles.map((r) => r.id);
  }
}
