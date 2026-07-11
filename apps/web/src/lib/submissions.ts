/**
 * Typen und API-Funktionen für das Ausschreibungsmodul.
 * Spiegelt die Antworten der NestJS-Submissions-Endpoints wider.
 */
import { apiClient } from './api-client';

export type SubmissionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'CANCELLED';

export type SubmissionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Ausschreibung mit Kundenbezug. */
export interface Submission {
  id: string;
  customerId: string;
  customer: { id: string; companyName: string };
  title: string;
  description: string | null;
  reference: string | null;
  source: string | null;
  status: SubmissionStatus;
  priority: SubmissionPriority;
  deadline: string | null;
  startDate: string | null;
  endDate: string | null;
  value: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requirements: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Daten zum Erstellen einer Ausschreibung. */
export interface CreateSubmissionData {
  customerId: string;
  title: string;
  description?: string;
  reference?: string;
  source?: string;
  status?: SubmissionStatus;
  priority?: SubmissionPriority;
  deadline?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  requirements?: string;
  notes?: string;
}

/** Daten zum Aktualisieren einer Ausschreibung. */
export type UpdateSubmissionData = Omit<Partial<CreateSubmissionData>, 'customerId'>;

/** Filter-Parameter für die Auflistung. */
export interface ListSubmissionsParams {
  customerId?: string;
  status?: string;
}

/** API-Client für Ausschreibungen (CRUD). */
export const submissionsApi = {
  /** GET /submissions – Listet Ausschreibungen, optional gefiltert. */
  list(params?: ListSubmissionsParams): Promise<Submission[]> {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiClient.get<Submission[]>(`/submissions${qs ? `?${qs}` : ''}`);
  },
  /** GET /submissions/:id – Lädt eine einzelne Ausschreibung. */
  get: (id: string) => apiClient.get<Submission>(`/submissions/${id}`),
  /** POST /submissions – Erstellt eine neue Ausschreibung. */
  create: (data: CreateSubmissionData) =>
    apiClient.post<Submission>('/submissions', data),
  /** PATCH /submissions/:id – Aktualisiert eine Ausschreibung. */
  update: (id: string, data: UpdateSubmissionData) =>
    apiClient.patch<Submission>(`/submissions/${id}`, data),
  /** DELETE /submissions/:id – Soft-Delete einer Ausschreibung. */
  remove: (id: string) => apiClient.delete<unknown>(`/submissions/${id}`),
};
