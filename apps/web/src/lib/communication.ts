/**
 * Typen und API-Funktionen für das Kommunikationsmodul.
 * Spiegelt die Antworten der NestJS-Communication-Endpoints wider.
 */
import { apiClient } from './api-client';

export type CommunicationEntityType = 'CUSTOMER' | 'SUBCONTRACTOR' | 'WORKER';
export type CommunicationType = 'PHONE_CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'INSTRUCTION';
export type CommunicationDirection = 'INCOMING' | 'OUTGOING';

export interface CommunicationEntry {
  id: string;
  entityType: CommunicationEntityType;
  entityId: string;
  contactId: string | null;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject: string | null;
  content: string;
  occurredAt: string;
  duration: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunicationData {
  entityType: CommunicationEntityType;
  entityId: string;
  contactId?: string;
  type: CommunicationType;
  direction?: CommunicationDirection;
  subject?: string;
  content: string;
  occurredAt?: string;
  duration?: number;
  createdBy?: string;
}

export type UpdateCommunicationData = Omit<
  Partial<CreateCommunicationData>,
  'entityType' | 'entityId'
>;

export interface ListCommunicationParams {
  entityType?: string;
  entityId?: string;
  contactId?: string;
  type?: string;
}

export const communicationApi = {
  list(params?: ListCommunicationParams): Promise<CommunicationEntry[]> {
    const q = new URLSearchParams();
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.entityId) q.set('entityId', params.entityId);
    if (params?.contactId) q.set('contactId', params.contactId);
    if (params?.type) q.set('type', params.type);
    const qs = q.toString();
    return apiClient.get<CommunicationEntry[]>(`/communication${qs ? `?${qs}` : ''}`);
  },
  create: (data: CreateCommunicationData) =>
    apiClient.post<CommunicationEntry>('/communication', data),
  update: (id: string, data: UpdateCommunicationData) =>
    apiClient.patch<CommunicationEntry>(`/communication/${id}`, data),
  remove: (id: string) => apiClient.delete<unknown>(`/communication/${id}`),
};
