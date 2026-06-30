/**
 * Typen und API-Funktionen für das Projektverwaltungs-Modul.
 * Spiegelt die Antworten der NestJS-Projects-Endpoints wider.
 */
import { apiClient } from './api-client';

export type ProjectStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELED';
export type ServiceType = 'VIDEO' | 'ELECTRICAL' | 'SERVICE' | 'OTHER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type BillingMode = 'HOURLY_PACKAGE' | 'UNIT_BASED' | 'MIXED';

// ── Sub-Entities ───────────────────────────────────────────────

export interface ProjectSite {
  id: string;
  projectId: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  accessInfo: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProjectEquipment {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  quantity: number;
  serialNumber: string | null;
  issuedAt: string;
  returnedAt: string | null;
  issuedTo: string | null;
  condition: string | null;
  returnCondition: string | null;
  notes: string | null;
}

export interface ProjectStatusHistory {
  id: string;
  projectId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string | null;
  comment: string | null;
  changedAt: string;
  changedBy: { id: string; displayName: string } | null;
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  workerId: string;
  roleName: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  isLead: boolean;
  notes: string | null;
  worker: {
    id: string;
    workerNumber: string;
    firstName: string;
    lastName: string;
  };
}

export interface ProjectEmailRecipient {
  id: string;
  projectId: string;
  email: string;
  recipientType: string;
  name: string | null;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
  createdBy: { id: string; displayName: string } | null;
}

// ── Project ────────────────────────────────────────────────────

export interface ProjectListItem {
  id: string;
  projectNumber: string;
  title: string;
  status: ProjectStatus;
  priority: Priority;
  serviceType: ServiceType;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  customer: { id: string; companyName: string };
  _count: { assignments: number };
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProjectDetail {
  id: string;
  projectNumber: string;
  customerId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  serviceType: ServiceType;
  status: ProjectStatus;
  priority: Priority;
  siteName: string | null;
  siteAddressLine1: string | null;
  sitePostalCode: string | null;
  siteCity: string | null;
  siteCountry: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  siteAccessInfo: string | null;
  siteWorkingHours: string | null;
  billingMode: BillingMode | null;
  weeklyPackageHours: number | null;
  weeklyPackagePrice: number | null;
  overtimeRatePerHour: number | null;
  accommodationAddressLine1: string | null;
  accommodationAddressLine2: string | null;
  accommodationPostalCode: string | null;
  accommodationCity: string | null;
  accommodationCountry: string | null;
  accommodationLatitude: number | null;
  accommodationLongitude: number | null;
  accommodationMapsUrl: string | null;
  accommodationNotes: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  internalProjectManagerUserId: string | null;
  primaryCustomerContactId: string | null;
  pauseRuleId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; companyName: string; customerNumber: string };
  branch: { id: string; name: string } | null;
  internalProjectManager: { id: string; displayName: string } | null;
  primaryCustomerContact: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  sites: ProjectSite[];
  equipment: ProjectEquipment[];
  emailRecipients: ProjectEmailRecipient[];
  assignments: ProjectAssignment[];
  statusHistory: ProjectStatusHistory[];
}

/** Schlanke Projektion für die Kalender-/Timeline-Ansicht. */
export interface ProjectTimelineItem {
  id: string;
  projectNumber: string;
  title: string;
  status: ProjectStatus;
  priority: Priority;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  customer: { id: string; companyName: string };
  _count: { assignments: number };
}

// ── Meta (Dropdown-Daten) ──────────────────────────────────────

export interface ProjectUserOption {
  id: string;
  displayName: string;
  email: string;
}

export interface ProjectWorkerOption {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
}

// ── Query-Parameter ────────────────────────────────────────────

export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  serviceType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface TimelineParams {
  from?: string;
  to?: string;
  customerId?: string;
  activeOnly?: boolean;
}

// ── API ────────────────────────────────────────────────────────

export const projectsApi = {
  list(params: ProjectListParams): Promise<ProjectListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.customerId) q.set('customerId', params.customerId);
    if (params.serviceType) q.set('serviceType', params.serviceType);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<ProjectListResponse>(`/projects?${q.toString()}`);
  },
  get: (id: string) => apiClient.get<ProjectDetail>(`/projects/${id}`),
  create: (body: unknown) => apiClient.post<ProjectDetail>('/projects', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<ProjectDetail>(`/projects/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`/projects/${id}`),

  // Status-Workflow
  changeStatus: (id: string, body: { status: ProjectStatus; comment?: string }) =>
    apiClient.post<ProjectDetail>(`/projects/${id}/status`, body),

  // Kalender / Timeline
  timeline(params: TimelineParams): Promise<ProjectTimelineItem[]> {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.customerId) q.set('customerId', params.customerId);
    if (params.activeOnly) q.set('activeOnly', 'true');
    return apiClient.get<ProjectTimelineItem[]>(
      `/projects/timeline?${q.toString()}`,
    );
  },

  // Meta (Dropdown-Daten)
  listUsers: () => apiClient.get<ProjectUserOption[]>('/projects/meta/users'),
  listWorkers: () =>
    apiClient.get<ProjectWorkerOption[]>('/projects/meta/workers'),

  // Sites
  listSites: (pid: string) =>
    apiClient.get<ProjectSite[]>(`/projects/${pid}/sites`),
  createSite: (pid: string, body: unknown) =>
    apiClient.post<ProjectSite>(`/projects/${pid}/sites`, body),
  updateSite: (pid: string, id: string, body: unknown) =>
    apiClient.patch<ProjectSite>(`/projects/${pid}/sites/${id}`, body),
  removeSite: (pid: string, id: string) =>
    apiClient.delete<unknown>(`/projects/${pid}/sites/${id}`),

  // Equipment
  listEquipment: (pid: string) =>
    apiClient.get<ProjectEquipment[]>(`/projects/${pid}/equipment`),
  createEquipment: (pid: string, body: unknown) =>
    apiClient.post<ProjectEquipment>(`/projects/${pid}/equipment`, body),
  updateEquipment: (pid: string, id: string, body: unknown) =>
    apiClient.patch<ProjectEquipment>(`/projects/${pid}/equipment/${id}`, body),
  removeEquipment: (pid: string, id: string) =>
    apiClient.delete<unknown>(`/projects/${pid}/equipment/${id}`),

  // E-Mail-Verteiler
  listEmailRecipients: (pid: string) =>
    apiClient.get<ProjectEmailRecipient[]>(
      `/projects/${pid}/email-recipients`,
    ),
  createEmailRecipient: (pid: string, body: unknown) =>
    apiClient.post<ProjectEmailRecipient>(
      `/projects/${pid}/email-recipients`,
      body,
    ),
  updateEmailRecipient: (pid: string, id: string, body: unknown) =>
    apiClient.patch<ProjectEmailRecipient>(
      `/projects/${pid}/email-recipients/${id}`,
      body,
    ),
  removeEmailRecipient: (pid: string, id: string) =>
    apiClient.delete<unknown>(`/projects/${pid}/email-recipients/${id}`),

  // Notizen
  listNotes: (pid: string) =>
    apiClient.get<ProjectNote[]>(`/projects/${pid}/notes`),
  createNote: (pid: string, body: { body: string }) =>
    apiClient.post<ProjectNote>(`/projects/${pid}/notes`, body),
  removeNote: (pid: string, id: string) =>
    apiClient.delete<unknown>(`/projects/${pid}/notes/${id}`),

  // Monteur-Zuordnungen
  listAssignments: (pid: string) =>
    apiClient.get<ProjectAssignment[]>(`/projects/${pid}/assignments`),
  createAssignment: (pid: string, body: unknown) =>
    apiClient.post<ProjectAssignment>(`/projects/${pid}/assignments`, body),
  updateAssignment: (pid: string, id: string, body: unknown) =>
    apiClient.patch<ProjectAssignment>(
      `/projects/${pid}/assignments/${id}`,
      body,
    ),
  removeAssignment: (pid: string, id: string) =>
    apiClient.delete<unknown>(`/projects/${pid}/assignments/${id}`),
};
