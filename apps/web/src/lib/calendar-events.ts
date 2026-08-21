/**
 * API-Helfer für Office-Termine (Calendar Events).
 */

import { apiClient } from './api-client';

export interface CalendarEventProject {
  id: string;
  projectNumber: string;
  title: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  projectId: string | null;
  googleEventId: string | null;
  syncToGoogle: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  project?: CalendarEventProject | null;
}

export interface CalendarEventListResponse {
  data: CalendarEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface CalendarEventListParams {
  from?: string;
  to?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

export type CreateCalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  projectId?: string;
  syncToGoogle?: boolean;
};

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export const calendarEventsApi = {
  list: (params: CalendarEventListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.projectId) qs.set('projectId', params.projectId);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiClient.get<CalendarEventListResponse>(
      `/calendar-events${q ? `?${q}` : ''}`,
    );
  },
  get: (id: string) => apiClient.get<CalendarEvent>(`/calendar-events/${id}`),
  create: (body: CreateCalendarEventInput) =>
    apiClient.post<CalendarEvent>('/calendar-events', body),
  update: (id: string, body: UpdateCalendarEventInput) =>
    apiClient.patch<CalendarEvent>(`/calendar-events/${id}`, body),
  remove: (id: string) =>
    apiClient.delete<{ id: string; deleted: boolean }>(
      `/calendar-events/${id}`,
    ),
};
