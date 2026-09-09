/**
 * API-Client für Benutzer- und Rollenverwaltung.
 */

import { apiClient } from './api-client';

export interface UserRoleRef {
  role: { code: string; name: string };
}

export interface OfficeUser {
  id: string;
  email: string;
  displayName: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: UserRoleRef[];
}

export interface RoleWithPermissions {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PermissionItem {
  code: string;
  description: string | null;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  displayName: string;
  notes?: string;
  roles: string[];
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  displayName?: string;
  notes?: string;
  isActive?: boolean;
  roles?: string[];
}

export const usersApi = {
  list(): Promise<OfficeUser[]> {
    return apiClient.get<OfficeUser[]>('/users');
  },
  get(id: string): Promise<OfficeUser> {
    return apiClient.get<OfficeUser>(`/users/${id}`);
  },
  create(data: CreateUserPayload): Promise<OfficeUser> {
    return apiClient.post<OfficeUser>('/users', data);
  },
  update(id: string, data: UpdateUserPayload): Promise<OfficeUser> {
    return apiClient.patch<OfficeUser>(`/users/${id}`, data);
  },
  deactivate(id: string): Promise<OfficeUser> {
    return apiClient.delete<OfficeUser>(`/users/${id}`);
  },
  setPin(id: string, pin: string): Promise<{ success: true }> {
    return apiClient.put<{ success: true }>(`/users/${id}/pin`, { pin });
  },
  listRoles(): Promise<RoleWithPermissions[]> {
    return apiClient.get<RoleWithPermissions[]>('/roles');
  },
  listPermissions(): Promise<PermissionItem[]> {
    return apiClient.get<PermissionItem[]>('/permissions');
  },
  setRolePermissions(
    code: string,
    permissions: string[],
  ): Promise<RoleWithPermissions> {
    return apiClient.put<RoleWithPermissions>(`/roles/${code}/permissions`, {
      permissions,
    });
  },
};
