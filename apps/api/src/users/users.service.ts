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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

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
