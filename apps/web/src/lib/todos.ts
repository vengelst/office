/**
 * API-Helfer für Todos und Dashboard-Widgets.
 */

import { apiClient } from './api-client';

/**
 * Typ/Interface `TodoStatus` für die Web-App.
 */
export type TodoStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
/**
 * Typ/Interface `TodoPriority` für die Web-App.
 */
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
/**
 * Typ/Interface `TodoEntityType` für die Web-App.
 */
export type TodoEntityType =
  | 'CUSTOMER'
  | 'PROJECT'
  | 'WORKER'
  | 'SUBCONTRACTOR'
  | 'EQUIPMENT';

/**
 * Typ/Interface `Todo` für die Web-App.
 */
export interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  completedAt: string | null;
  assignedToId: string | null;
  createdById: string | null;
  linkedEntityType: TodoEntityType | null;
  linkedEntityId: string | null;
  linkedEntityName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Typ/Interface `TodoListResponse` für die Web-App.
 */
export interface TodoListResponse {
  data: Todo[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Typ/Interface `TodoListParams` für die Web-App.
 */
export interface TodoListParams {
  status?: TodoStatus;
  priority?: TodoPriority;
  assignedToId?: string;
  linkedEntityType?: TodoEntityType;
  linkedEntityId?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Typ/Interface `TodoDashboardData` für die Web-App.
 */
export interface TodoDashboardData {
  openCount: number;
  overdueCount: number;
  upcoming: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    status: string;
    linkedEntityName: string | null;
  }>;
}

/**
 * Typ/Interface `TodoUser` für die Web-App.
 */
export interface TodoUser {
  id: string;
  displayName: string;
}

export const todosApi = {
  list(params?: TodoListParams): Promise<TodoListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    const qs = searchParams.toString();
    return apiClient.get<TodoListResponse>(`/todos${qs ? `?${qs}` : ''}`);
  },

  getMyTodos(status?: TodoStatus): Promise<Todo[]> {
    const qs = status ? `?status=${status}` : '';
    return apiClient.get<Todo[]>(`/todos/my${qs}`);
  },

  getDashboard(): Promise<TodoDashboardData> {
    return apiClient.get<TodoDashboardData>('/todos/dashboard');
  },

  get(id: string): Promise<Todo> {
    return apiClient.get<Todo>(`/todos/${id}`);
  },

  create(data: Partial<Todo>): Promise<Todo> {
    return apiClient.post<Todo>('/todos', data);
  },

  update(id: string, data: Partial<Todo>): Promise<Todo> {
    return apiClient.patch<Todo>(`/todos/${id}`, data);
  },

  updateStatus(id: string, status: TodoStatus): Promise<Todo> {
    return apiClient.patch<Todo>(`/todos/${id}/status`, { status });
  },

  remove(id: string): Promise<void> {
    return apiClient.delete<void>(`/todos/${id}`);
  },
  bulkRemove(ids: string[]): Promise<{ deleted: number; failed: number }> {
    return apiClient.post<{ deleted: number; failed: number }>('/todos/bulk-delete', { ids });
  },

  getUsers(): Promise<TodoUser[]> {
    return apiClient.get<TodoUser[]>('/todos/users');
  },
};
