/**
 * Typen und API-Funktionen für das Monteur-/Personalmodul.
 * Spiegelt die Antworten der NestJS-Workers-/Subcontractors-/Teams-Endpoints wider.
 */
import { apiClient } from './api-client';

export type WorkerType = 'EMPLOYED' | 'SUBCONTRACTED';
export type WorkerAvailability =
  | 'AVAILABLE'
  | 'ON_PROJECT'
  | 'SICK'
  | 'VACATION'
  | 'UNAVAILABLE';
export type LanguageProficiency =
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2'
  | 'C1'
  | 'C2'
  | 'NATIVE';

// ── Sub-Entities ───────────────────────────────────────────────

export interface WorkerLanguage {
  id: string;
  workerId: string;
  language: string;
  proficiency: LanguageProficiency;
}

export interface WorkerCertification {
  id: string;
  workerId: string;
  name: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
}

export interface WorkerAssignmentProject {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
}

export interface WorkerAssignment {
  id: string;
  projectId: string;
  workerId: string;
  roleName: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  isLead: boolean;
  notes: string | null;
  project: WorkerAssignmentProject;
}

export interface WorkerTeamMembership {
  id: string;
  teamId: string;
  workerId: string;
  joinedAt: string;
  leftAt: string | null;
  role: string | null;
  team: { id: string; name: string };
}

export interface WorkerEquipmentIssue {
  id: string;
  workerId: string;
  equipmentItemId: string;
  issuedAt: string;
  returnedAt: string | null;
  conditionOut: string | null;
  conditionIn: string | null;
  notes: string | null;
  equipmentItem?: {
    id: string;
    name: string;
    category: string;
    itemNumber: string;
  };
}

// ── Worker ─────────────────────────────────────────────────────

export interface WorkerListItem {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  workerType: WorkerType;
  availability: WorkerAvailability;
  hourlyRate: number | null;
  phone: string | null;
  email: string | null;
  subcontractor: { id: string; name: string } | null;
  assignments: WorkerAssignment[];
}

export interface WorkerListResponse {
  data: WorkerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkerDetail {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  nationality: string | null;
  active: boolean;
  photoPath: string | null;
  hasDriversLicense: boolean;
  notes: string | null;
  workerType: WorkerType;
  availability: WorkerAvailability;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  idNumber: string | null;
  taxNumber: string | null;
  socialSecurityNumber: string | null;
  oib: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  residencePermitNumber: string | null;
  residencePermitExpiry: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
  subcontractorId: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  shoeSize: string | null;
  clothingSize: string | null;
  createdAt: string;
  updatedAt: string;
  subcontractor: { id: string; name: string; city: string | null } | null;
  languages: WorkerLanguage[];
  certifications: WorkerCertification[];
  teamMemberships: WorkerTeamMembership[];
  assignments: WorkerAssignment[];
  currentAssignment: WorkerAssignment | null;
  equipmentIssues?: WorkerEquipmentIssue[];
}

export interface ExpiringDocumentWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  passportNumber: string | null;
  passportExpiry: string | null;
  residencePermitNumber: string | null;
  residencePermitExpiry: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
}

// ── Subcontractor ──────────────────────────────────────────────

export interface SubcontractorListItem {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  active: boolean;
  _count: { workers: number };
}

export interface SubcontractorListResponse {
  data: SubcontractorListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SubcontractorWorker {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  availability: WorkerAvailability;
  photoPath: string | null;
}

export interface SubcontractorDetail {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  taxNumber: string | null;
  vatId: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  workers: SubcontractorWorker[];
}

// ── Team ───────────────────────────────────────────────────────

export interface TeamLeader {
  id: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  availability: WorkerAvailability;
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  leader: TeamLeader | null;
  _count: { members: number };
}

export interface TeamMember {
  id: string;
  teamId: string;
  workerId: string;
  joinedAt: string;
  leftAt: string | null;
  role: string | null;
  worker: TeamLeader;
}

export interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  leader: TeamLeader | null;
  members: TeamMember[];
}

// ── Query-Parameter ────────────────────────────────────────────

export interface WorkerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  availability?: string;
  subcontractorId?: string;
  teamId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface SubcontractorListParams {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── API ────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3801/api';

export const workersApi = {
  list(params: WorkerListParams): Promise<WorkerListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.type) q.set('type', params.type);
    if (params.availability) q.set('availability', params.availability);
    if (params.subcontractorId) q.set('subcontractorId', params.subcontractorId);
    if (params.teamId) q.set('teamId', params.teamId);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<WorkerListResponse>(`/workers?${q.toString()}`);
  },
  get: (id: string) => apiClient.get<WorkerDetail>(`/workers/${id}`),
  create: (body: unknown) => apiClient.post<WorkerDetail>('/workers', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<WorkerDetail>(`/workers/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`/workers/${id}`),

  expiringDocuments: () =>
    apiClient.get<ExpiringDocumentWorker[]>('/workers/expiring-documents'),

  // Profilbild-URL (für <img>-Anzeige mit Auth-Header per fetch)
  photoUrl: (id: string) => `${API_BASE_URL}/workers/${id}/photo`,

  // Sprachkenntnisse
  listLanguages: (id: string) =>
    apiClient.get<WorkerLanguage[]>(`/workers/${id}/languages`),
  createLanguage: (id: string, body: unknown) =>
    apiClient.post<WorkerLanguage>(`/workers/${id}/languages`, body),
  updateLanguage: (id: string, langId: string, body: unknown) =>
    apiClient.patch<WorkerLanguage>(`/workers/${id}/languages/${langId}`, body),
  removeLanguage: (id: string, langId: string) =>
    apiClient.delete<unknown>(`/workers/${id}/languages/${langId}`),

  // Zertifikate
  listCertifications: (id: string) =>
    apiClient.get<WorkerCertification[]>(`/workers/${id}/certifications`),
  createCertification: (id: string, body: unknown) =>
    apiClient.post<WorkerCertification>(`/workers/${id}/certifications`, body),
  updateCertification: (id: string, certId: string, body: unknown) =>
    apiClient.patch<WorkerCertification>(
      `/workers/${id}/certifications/${certId}`,
      body,
    ),
  removeCertification: (id: string, certId: string) =>
    apiClient.delete<unknown>(`/workers/${id}/certifications/${certId}`),
};

export const subcontractorsApi = {
  list(params: SubcontractorListParams): Promise<SubcontractorListResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.active !== undefined) q.set('active', String(params.active));
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortDir) q.set('sortDir', params.sortDir);
    return apiClient.get<SubcontractorListResponse>(
      `/subcontractors?${q.toString()}`,
    );
  },
  get: (id: string) =>
    apiClient.get<SubcontractorDetail>(`/subcontractors/${id}`),
  create: (body: unknown) =>
    apiClient.post<SubcontractorDetail>('/subcontractors', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<SubcontractorDetail>(`/subcontractors/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`/subcontractors/${id}`),
};

export const teamsApi = {
  list: () => apiClient.get<TeamListItem[]>('/teams'),
  get: (id: string) => apiClient.get<TeamDetail>(`/teams/${id}`),
  create: (body: unknown) => apiClient.post<TeamDetail>('/teams', body),
  update: (id: string, body: unknown) =>
    apiClient.patch<TeamDetail>(`/teams/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`/teams/${id}`),
  addMember: (id: string, body: unknown) =>
    apiClient.post<TeamMember>(`/teams/${id}/members`, body),
  removeMember: (id: string, memberId: string) =>
    apiClient.delete<unknown>(`/teams/${id}/members/${memberId}`),
};

// ── Helfer ─────────────────────────────────────────────────────

export const workerFullName = (w: {
  firstName: string;
  lastName: string;
}): string => [w.firstName, w.lastName].filter(Boolean).join(' ');

/**
 * Ablauf-Status eines Datums für gelb/rot-Markierung.
 * 'expired' = abgelaufen (rot), 'soon' = < 30 Tage (gelb), 'ok' / null sonst.
 */
export type ExpiryStatus = 'expired' | 'soon' | 'ok' | null;

export function expiryStatus(
  value: string | null | undefined,
  windowDays = 30,
): ExpiryStatus {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return 'expired';
  if (diffDays <= windowDays) return 'soon';
  return 'ok';
}
