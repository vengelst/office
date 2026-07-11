import {
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

  /** Deaktiviert den Benutzer (Soft-Disable statt Löschen). */
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect,
    });
  }

  /** Löst Rollen-Codes in Datenbank-IDs auf. Wirft Fehler bei unbekannten Codes. */
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
