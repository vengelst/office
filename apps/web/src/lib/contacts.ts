/**
 * API-Helfer für Kontakt-Suggestions und Stammdaten.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Typ/Interface `ContactSuggestionSource` für die Web-App.
 */
export type ContactSuggestionSource = 'CUSTOMER' | 'SUBCONTRACTOR';

/**
 * Typ/Interface `ContactSuggestion` für die Web-App.
 */
export interface ContactSuggestion {
  id: string;
  source: ContactSuggestionSource;
  customerId: string | null;
  subcontractorId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneMobile: string | null;
  role: string | null;
  companyName: string | null;
  label: string;
}

/**
 * Typ/Interface `ContactSuggestionsParams` für die Web-App.
 */
export interface ContactSuggestionsParams {
  q?: string;
  customerId?: string;
  limit?: number;
}

export const contactsApi = {
  suggestions(params: ContactSuggestionsParams = {}): Promise<ContactSuggestion[]> {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.customerId) q.set('customerId', params.customerId);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiClient.get<ContactSuggestion[]>(
      `/contacts/suggestions${qs ? `?${qs}` : ''}`,
    );
  },
};
