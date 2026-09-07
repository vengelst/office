/**
 * API-Helfer für Kommunikations-/Nachrichten-Einträge.
 */

import { apiClient } from './api-client';

export type CommunicationEntityType = 'CUSTOMER' | 'SUBCONTRACTOR' | 'WORKER';
export type CommunicationType =
  | 'PHONE_CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'NOTE'
  | 'INSTRUCTION'
  | 'WHATSAPP';
export type CommunicationDirection = 'INCOMING' | 'OUTGOING';

/**
 * Typ/Interface `CommunicationEntry` für die Web-App.
 */
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
  entityName?: string | null;
  contactName?: string | null;
  createdByName?: string | null;
}

/**
 * Typ/Interface `CommunicationListParams` für die Web-App.
 */
export interface CommunicationListParams {
  entityType?: string;
  entityId?: string;
  contactId?: string;
  type?: string;
  createdBy?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/**
 * Typ/Interface `CommunicationListResponse` für die Web-App.
 */
export interface CommunicationListResponse {
  data: CommunicationEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface CommunicationAuthor {
  id: string;
  displayName: string;
  email: string;
}

export const communicationApi = {
  list(params: CommunicationListParams = {}): Promise<CommunicationListResponse> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    return apiClient.get<CommunicationListResponse>(
      `/communication${qs ? `?${qs}` : ''}`,
    );
  },

  listAuthors(): Promise<CommunicationAuthor[]> {
    return apiClient.get<CommunicationAuthor[]>('/communication/authors');
  },

  get(id: string): Promise<CommunicationEntry> {
    return apiClient.get<CommunicationEntry>(`/communication/${id}`);
  },

  create(
    data: Pick<
      CommunicationEntry,
      'entityType' | 'entityId' | 'type' | 'direction' | 'content' | 'occurredAt'
    > & {
      contactId?: string;
      subject?: string;
      duration?: number;
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

/** Kurz-Titel für To-Do / Termin aus einem Kommunikationseintrag. */
export function communicationPrefillTitle(entry: CommunicationEntry): string {
  const subject = entry.subject?.trim();
  if (subject) return subject.slice(0, 120);
  const content = entry.content.trim().replace(/\s+/g, ' ');
  if (content.length <= 80) return content;
  return `${content.slice(0, 77)}…`;
}

export function communicationEntityHref(entry: CommunicationEntry): string {
  if (entry.entityType === 'CUSTOMER') return `/customers/${entry.entityId}`;
  if (entry.entityType === 'SUBCONTRACTOR') {
    return `/subcontractors/${entry.entityId}`;
  }
  return `/workers/${entry.entityId}`;
}
