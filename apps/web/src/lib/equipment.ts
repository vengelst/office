/**
 * Typen und API-Funktionen für das Werkzeug- & Gerätemanagement.
 */
import { apiClient, apiUpload } from './api-client';

export type EquipmentStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_REPAIR' | 'RETIRED';
export type EquipmentCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DEFECTIVE';

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_REPAIR',
  'RETIRED',
];

export const EQUIPMENT_CONDITIONS: EquipmentCondition[] = [
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DEFECTIVE',
];

export interface EquipmentWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
}

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  workerId: string;
  assignedAt: string;
  expectedReturn: string | null;
  returnedAt: string | null;
  notes: string | null;
  returnNotes: string | null;
  returnCondition: EquipmentCondition | null;
  assignedBy: string | null;
  worker: EquipmentWorker;
}

export interface EquipmentBase {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  inventoryNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  imageKey: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentListItem extends EquipmentBase {
  currentAssignment: EquipmentAssignment | null;
}

export interface EquipmentListResponse {
  data: EquipmentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EquipmentDetail extends EquipmentBase {
  assignments: EquipmentAssignment[];
  currentAssignment: EquipmentAssignment | null;
  history: EquipmentAssignment[];
}

export interface EquipmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
}

export const equipmentApi = {
  list(params: EquipmentListParams = {}): Promise<EquipmentListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.category) q.set('category', params.category);
    return apiClient.get<EquipmentListResponse>(`/equipment?${q.toString()}`);
  },
  get: (id: string) => apiClient.get<EquipmentDetail>(`/equipment/${id}`),
  create: (body: unknown) => apiClient.post<EquipmentDetail>('/equipment', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<EquipmentDetail>(`/equipment/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<{ id: string; deleted: boolean }>(`/equipment/${id}`),
  uploadImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiUpload<{ id: string; imageKey: string }>(
      `/equipment/${id}/image`,
      fd,
    );
  },
  assign: (
    id: string,
    body: { workerId: string; expectedReturn?: string; notes?: string },
  ) => apiClient.post<EquipmentDetail>(`/equipment/${id}/assign`, body),
  returnEquipment: (
    id: string,
    body: { returnNotes?: string; returnCondition?: string },
  ) => apiClient.post<EquipmentDetail>(`/equipment/${id}/return`, body),
  listWorkers: () =>
    apiClient.get<EquipmentWorker[]>('/equipment/meta/workers'),
  listCategories: () =>
    apiClient.get<string[]>('/equipment/meta/categories'),
  getWorkerEquipment: (workerId: string) =>
    apiClient.get<
      Array<{
        id: string;
        assignedAt: string;
        equipment: {
          id: string;
          name: string;
          category: string | null;
          inventoryNumber: string | null;
          imageKey: string | null;
        };
      }>
    >(`/equipment/worker/${workerId}`),
};
