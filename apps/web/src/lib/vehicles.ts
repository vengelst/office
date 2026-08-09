/**
 * API-Helfer für Fahrzeugverwaltung.
 */

import { apiClient } from './api-client';

/**
 * Typ/Interface `VehicleOwnerType` für die Web-App.
 */
export type VehicleOwnerType = 'OWN' | 'SUBCONTRACTOR';
/**
 * Typ/Interface `VehicleCategory` für die Web-App.
 */
export type VehicleCategory = 'PKW' | 'Transporter' | 'LKW' | 'Anhänger';
/**
 * Typ/Interface `VehicleFuelType` für die Web-App.
 */
export type VehicleFuelType = 'Diesel' | 'Benzin' | 'Elektro' | 'Hybrid';

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'PKW',
  'Transporter',
  'LKW',
  'Anhänger',
];
export const VEHICLE_FUEL_TYPES: VehicleFuelType[] = [
  'Diesel',
  'Benzin',
  'Elektro',
  'Hybrid',
];
export const VEHICLE_OWNER_TYPES: VehicleOwnerType[] = ['OWN', 'SUBCONTRACTOR'];

// ── Sub-Entities ───────────────────────────────────────────────

/**
 * Typ/Interface `VehicleWorker` für die Web-App.
 */
export interface VehicleWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
}

/**
 * Typ/Interface `VehicleAssignment` für die Web-App.
 */
export interface VehicleAssignment {
  id: string;
  workerId: string;
  vehicleId: string;
  assignedFrom: string;
  assignedTo: string | null;
  notes: string | null;
  worker: VehicleWorker;
}

// ── Vehicle ────────────────────────────────────────────────────

/**
 * Typ/Interface `VehicleBase` für die Web-App.
 */
export interface VehicleBase {
  id: string;
  licensePlate: string;
  make: string | null;
  model: string | null;
  internalName: string | null;
  active: boolean;
  ownerType: VehicleOwnerType | null;
  subcontractorId: string | null;
  category: VehicleCategory | null;
  year: number | null;
  vin: string | null;
  color: string | null;
  fuelType: VehicleFuelType | null;
  nextInspection: string | null;
  insuranceExpiry: string | null;
  registrationDoc: string | null;
  notes: string | null;
}

/**
 * Typ/Interface `VehicleListItem` für die Web-App.
 */
export interface VehicleListItem extends VehicleBase {
  subcontractor: { id: string; name: string } | null;
  currentAssignment: VehicleAssignment | null;
}

/**
 * Typ/Interface `VehicleListResponse` für die Web-App.
 */
export interface VehicleListResponse {
  data: VehicleListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Typ/Interface `VehicleDetail` für die Web-App.
 */
export interface VehicleDetail extends VehicleBase {
  subcontractor: { id: string; name: string; city: string | null } | null;
  assignments: VehicleAssignment[];
  currentAssignment: VehicleAssignment | null;
  history: VehicleAssignment[];
}

/**
 * Typ/Interface `ExpiringVehicle` für die Web-App.
 */
export interface ExpiringVehicle {
  id: string;
  licensePlate: string;
  internalName: string | null;
  make: string | null;
  model: string | null;
  nextInspection: string | null;
  insuranceExpiry: string | null;
}

// ── Query-Parameter ────────────────────────────────────────────

/**
 * Typ/Interface `VehicleListParams` für die Web-App.
 */
export interface VehicleListParams {
  page?: number;
  limit?: number;
  search?: string;
  ownerType?: string;
  category?: string;
  subcontractorId?: string;
  status?: string;
  active?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── API ────────────────────────────────────────────────────────

export const vehiclesApi = {
  list(params: VehicleListParams): Promise<VehicleListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.ownerType) q.set('ownerType', params.ownerType);
    if (params.category) q.set('category', params.category);
    if (params.subcontractorId)
      q.set('subcontractorId', params.subcontractorId);
    if (params.status) q.set('status', params.status);
    if (params.active !== undefined) q.set('active', String(params.active));
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<VehicleListResponse>(`/vehicles?${q.toString()}`);
  },
  get: (id: string) => apiClient.get<VehicleDetail>(`/vehicles/${id}`),
  create: (body: unknown) => apiClient.post<VehicleDetail>('/vehicles', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<VehicleDetail>(`/vehicles/${id}`, body),
  deactivate: (id: string) =>
    apiClient.post<{ id: string; deactivated: boolean }>(`/vehicles/${id}/deactivate`),
  reactivate: (id: string) =>
    apiClient.post<{ id: string; reactivated: boolean }>(`/vehicles/${id}/reactivate`),
  remove: (id: string) =>
    apiClient.delete<{ id: string; deleted: boolean; deactivated: boolean }>(`/vehicles/${id}`),
  assign: (id: string, body: { workerId: string; notes?: string }) =>
    apiClient.post<VehicleDetail>(`/vehicles/${id}/assign`, body),
  unassign: (id: string) =>
    apiClient.post<VehicleDetail>(`/vehicles/${id}/unassign`),
  expiring: () => apiClient.get<ExpiringVehicle[]>('/vehicles/expiring'),
  listWorkers: () => apiClient.get<VehicleWorker[]>('/vehicles/meta/workers'),
};

// ── Helfer ─────────────────────────────────────────────────────

/**
 * API-/UI-Helfer `vehicleTitle` (vehicle Title).
 */
export const vehicleTitle = (v: {
  make: string | null;
  model: string | null;
}): string => [v.make, v.model].filter(Boolean).join(' ') || '–';
