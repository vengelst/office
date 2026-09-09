/**
 * Lädt die Union aller Permission-Codes eines Users über seine Rollen.
 */

import { PrismaService } from '../prisma/prisma.service';

export async function loadPermissionsForUser(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    select: { permission: { select: { code: true } } },
  });
  return [...new Set(rows.map((r) => r.permission.code))].sort();
}

export async function loadRolesAndPermissionsForUser(
  prisma: PrismaService,
  userId: string,
): Promise<{ roles: string[]; permissions: string[]; displayName?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      isActive: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!user || !user.isActive) {
    return { roles: [], permissions: [] };
  }
  const roles = user.roles.map((ur) => ur.role.code);
  if (roles.includes('SUPERADMIN')) {
    const all = await prisma.permission.findMany({ select: { code: true } });
    return {
      roles,
      permissions: all.map((p) => p.code).sort(),
      displayName: user.displayName,
    };
  }
  const permissions = await loadPermissionsForUser(prisma, userId);
  return { roles, permissions, displayName: user.displayName };
}

export function userHasPermission(
  roles: string[] | undefined,
  permissions: string[] | undefined,
  required: string | string[],
): boolean {
  if (roles?.includes('SUPERADMIN')) return true;
  const need = Array.isArray(required) ? required : [required];
  const have = new Set(permissions ?? []);
  return need.some((code) => have.has(code));
}
