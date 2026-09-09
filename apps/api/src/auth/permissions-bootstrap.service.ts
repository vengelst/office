/**
 * Stellt fehlende Permission-Codes und Standard-Rollen-Verknüpfungen beim API-Start sicher.
 * Idempotent und produktions-sicher (nur Inserts, keine Deletes).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_CODES,
  PERMISSION_DESCRIPTIONS,
  roleAllowsPermission,
} from './permissions.constants';

@Injectable()
export class PermissionsBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensurePermissionsAndLinks();
    } catch (err) {
      this.logger.warn(
        `Permissions-Bootstrap fehlgeschlagen: ${(err as Error).message}`,
      );
    }
  }

  private async ensurePermissionsAndLinks(): Promise<void> {
    for (const code of PERMISSION_CODES) {
      await this.prisma.permission.upsert({
        where: { code },
        update: { description: PERMISSION_DESCRIPTIONS[code] },
        create: {
          code,
          description: PERMISSION_DESCRIPTIONS[code],
        },
      });
    }

    const permissions = await this.prisma.permission.findMany({
      select: { id: true, code: true },
    });
    const permByCode = new Map(permissions.map((p) => [p.code, p.id]));

    const roles = await this.prisma.role.findMany({
      select: { id: true, code: true },
    });

    let linked = 0;
    for (const role of roles) {
      for (const code of PERMISSION_CODES) {
        if (!roleAllowsPermission(role.code, code)) continue;
        const permissionId = permByCode.get(code);
        if (!permissionId) continue;
        const existing = await this.prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          select: { id: true },
        });
        if (existing) continue;
        await this.prisma.rolePermission.create({
          data: { roleId: role.id, permissionId },
        });
        linked += 1;
      }
    }

    if (linked > 0) {
      this.logger.log(
        `Permissions-Bootstrap: ${PERMISSION_CODES.length} Codes, ${linked} neue Rollen-Links`,
      );
    }
  }
}

/** Alle RoleCode-Werte für Typ-Checks (Bootstrap nutzt String-Codes aus DB). */
export const ALL_ROLE_CODES: RoleCode[] = [
  RoleCode.SUPERADMIN,
  RoleCode.OFFICE,
  RoleCode.PROJECT_MANAGER,
  RoleCode.WORKER,
  RoleCode.CUSTOMER_PL,
];
