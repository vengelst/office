/**
 * Stellt sicher, dass alle Permission-Codes existieren.
 * Neue Codes bekommen Default-Rollen-Links; bestehende Matrix bleibt unberührt.
 * SUPERADMIN erhält immer alle fehlenden Links.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_CODES,
  roleHasDefaultPermission,
} from './permissions.constants';

@Injectable()
export class PermissionsBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensurePermissions();
    } catch (err) {
      this.logger.warn(
        `Permission-Bootstrap übersprungen: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async ensurePermissions(): Promise<void> {
    const existing = await this.prisma.permission.findMany({
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((p) => p.code));
    const newlyAdded: string[] = [];

    for (const code of PERMISSION_CODES) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      if (!existingCodes.has(code)) newlyAdded.push(code);
    }

    const roles = await this.prisma.role.findMany({
      select: { id: true, code: true },
    });
    const perms = await this.prisma.permission.findMany({
      select: { id: true, code: true },
    });
    const permByCode = new Map(perms.map((p) => [p.code, p.id]));

    for (const role of roles) {
      for (const code of PERMISSION_CODES) {
        const permissionId = permByCode.get(code);
        if (!permissionId) continue;

        const shouldLink =
          role.code === RoleCode.SUPERADMIN ||
          (newlyAdded.includes(code) &&
            roleHasDefaultPermission(role.code, code));

        if (!shouldLink) continue;

        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }

    this.logger.log(
      `Permission-Bootstrap: ${PERMISSION_CODES.length} Codes` +
        (newlyAdded.length
          ? `, neu verknüpft: ${newlyAdded.join(', ')}`
          : ''),
    );
  }
}
