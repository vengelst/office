import { apiClient } from './api-client';

export type RoleCode =
  | 'SUPERADMIN'
  | 'OFFICE'
  | 'PROJECT_MANAGER'
  | 'WORKER'
  | 'CUSTOMER_PL';

export interface OfficeUser {
  id: string;
  email: string;
  displayName: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { role: { code: RoleCode; name: string } }[];
}

export interface RoleWithPermissions {
  id: string;
  code: RoleCode;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PermissionRow {
  id: string;
  code: string;
  description: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  notes?: string;
  roles: RoleCode[];
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  displayName?: string;
  notes?: string;
  isActive?: boolean;
  roles?: RoleCode[];
}

export const usersApi = {
  list: () => apiClient.get<OfficeUser[]>('/users'),
  get: (id: string) => apiClient.get<OfficeUser>(`/users/${id}`),
  create: (body: CreateUserInput) =>
    apiClient.post<OfficeUser>('/users', body),
  update: (id: string, body: UpdateUserInput) =>
    apiClient.patch<OfficeUser>(`/users/${id}`, body),
  deactivate: (id: string) => apiClient.delete<OfficeUser>(`/users/${id}`),
  listRoles: () =>
    apiClient.get<RoleWithPermissions[]>('/users/meta/roles'),
  listPermissions: () =>
    apiClient.get<PermissionRow[]>('/users/meta/permissions'),
  setRolePermissions: (code: RoleCode, permissions: string[]) =>
    apiClient.put<RoleWithPermissions>(
      `/users/meta/roles/${code}/permissions`,
      { permissions },
    ),
};
