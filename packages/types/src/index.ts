// Shared TypeScript Types für Office
// Re-exportiert die von Prisma generierten Model- und Enum-Typen,
// damit Frontend und Backend dieselben Typen nutzen.

export * from '@prisma/client';

// ──────────────────────────────────────────────────────────────
// Auth / JWT
// ──────────────────────────────────────────────────────────────

export type ActorType = 'user' | 'worker';

export interface JwtPayload {
  /** userId (type=user) oder workerId (type=worker) */
  sub: string;
  type: ActorType;
  roles: string[];
  /** Permission-Codes aus RolePermission (bei Workern oft leer). */
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  type: ActorType;
  roles: string[];
  /** Permission-Codes; bei Office-Usern immer gesetzt (ggf. leeres Array). */
  permissions?: string[];
  displayName?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ──────────────────────────────────────────────────────────────
// API-Fehler
// ──────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}
