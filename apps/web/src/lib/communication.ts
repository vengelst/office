import { apiClient } from './api-client';

export interface CommunicationEntry {
  id: string;
  entityType: 'CUSTOMER' | 'SUBCONTRACTOR' | 'WORKER';
  entityId: string;
  contactId: string | null;
  type: 'PHONE_CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'INSTRUCTION';
  direction: 'INCOMING' | 'OUTGOING';
  subject: string | null;
  content: string;
  occurredAt: string;
  duration: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationListParams {
  entityType: string;
  entityId: string;
  contactId?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface CommunicationListResponse {
  data: CommunicationEntry[];
  total: number;
  page: number;
  limit: number;
}

export const communicationApi = {
  list(params: CommunicationListParams): Promise<CommunicationListResponse> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    return apiClient.get<CommunicationListResponse>(
      `/communication?${searchParams.toString()}`,
    );
  },

  get(id: string): Promise<CommunicationEntry> {
    return apiClient.get<CommunicationEntry>(`/communication/${id}`);
  },

  create(
    data: Pick<CommunicationEntry, 'entityType' | 'entityId' | 'type' | 'direction' | 'content' | 'occurredAt'> & {
      contactId?: string;
      subject?: string;
      duration?: number;
      createdBy?: string;
    },
  ): Promise<CommunicationEntry> {
    return apiClient.post<CommunicationEntry>('/communication', data);
  },

  update(
    id: string,
    data: Partial<CommunicationEntry>,
  ): Promise<CommunicationEntry> {
    return apiClient.patch<CommunicationEntry>(`/communication/${id}`, data);
  },

  remove(id: string): Promise<void> {
    return apiClient.delete<void>(`/communication/${id}`);
  },
};
