/**
 * API-Client für Master-Tätigkeitsbereiche.
 */

import { apiClient } from '@/lib/api-client';
import { workerFetch } from '@/lib/timesheets';

export interface ActivityTypeItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActivityTypeBody = {
  code: string;
  name: string;
  sortOrder?: number;
  active?: boolean;
  billable?: boolean;
};

export const activityTypesApi = {
  /** Büro-Token (Einstellungen). */
  list: (active?: boolean) => {
    const q =
      active === undefined ? '' : `?active=${active ? 'true' : 'false'}`;
    return apiClient.get<ActivityTypeItem[]>(`/activity-types${q}`);
  },
  /** Worker-/Kiosk-Token. */
  listActiveForWorker: () =>
    workerFetch<ActivityTypeItem[]>('/activity-types?active=true'),
  create: (body: ActivityTypeBody) =>
    apiClient.post<ActivityTypeItem>('/activity-types', body),
  update: (id: string, body: Partial<ActivityTypeBody>) =>
    apiClient.patch<ActivityTypeItem>(`/activity-types/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<ActivityTypeItem>(`/activity-types/${id}`),
};
