/**
 * Lädt Permission-Codes eines Benutzers über UserRole → Role → RolePermission → Permission.
 */

import { PrismaService } from '../prisma/prisma.service';

/**
 * Liefert eindeutige Permission-Codes für einen Office-Benutzer (userId).
 *
 * @param prisma - PrismaService
 * @param userId - User-ID
 * @returns Sortierte Liste eindeutiger Codes
 */
export async function loadPermissionsForUser(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  const codes = new Set<string>();
  for (const ur of rows) {
    for (const rp of ur.role.permissions) {
      codes.add(rp.permission.code);
    }
  }
  return [...codes].sort();
}

/**
 * Lädt Rollen-Codes und Permissions eines Benutzers frisch aus der DB.
 */
export async function loadRolesAndPermissionsForUser(
  prisma: PrismaService,
  userId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  const roles = (user?.roles ?? []).map((ur) => ur.role.code);
  const permissions = await loadPermissionsForUser(prisma, userId);
  return { roles, permissions };
}
