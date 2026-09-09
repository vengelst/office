/**
 * Service für Rollen- und Permission-Verwaltung.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CODES } from '../auth/permissions.constants';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Alle Rollen mit zugeordneten Permission-Codes.
   */
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: {
        permissions: {
          include: { permission: { select: { code: true, description: true } } },
        },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissions: r.permissions
        .map((rp) => rp.permission.code)
        .sort(),
    }));
  }

  /**
   * Alle bekannten Permission-Codes (DB + Konstanten).
   */
  async listPermissions() {
    const rows = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, description: true },
    });
    const known = new Set(rows.map((r) => r.code));
    for (const code of PERMISSION_CODES) {
      if (!known.has(code)) {
        rows.push({ code, description: null });
      }
    }
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Ersetzt die Permission-Zuordnung einer Rolle vollständig.
   */
  async setRolePermissions(code: string, permissions: string[]) {
    const role = await this.prisma.role.findUnique({
      where: { code: code as RoleCode },
    });
    if (!role) {
      throw new NotFoundException(`Rolle ${code} nicht gefunden`);
    }

    const unique = [...new Set(permissions)];
    const permRows = await this.prisma.permission.findMany({
      where: { code: { in: unique } },
      select: { id: true, code: true },
    });
    if (permRows.length !== unique.length) {
      const found = new Set(permRows.map((p) => p.code));
      const missing = unique.filter((c) => !found.has(c));
      throw new BadRequestException(
        `Unbekannte Berechtigungen: ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: permRows.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
      }),
    ]);

    return this.listRoles().then((all) =>
      all.find((r) => r.code === role.code),
    );
  }
}
