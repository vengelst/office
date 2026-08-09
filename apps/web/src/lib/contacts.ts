import { apiClient } from '@/lib/api-client';

export type ContactSuggestionSource = 'CUSTOMER' | 'SUBCONTRACTOR';

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
