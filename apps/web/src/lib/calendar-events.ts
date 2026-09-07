/**
 * API-Helfer für Office-Termine (CalendarEvent).
 */

import { apiClient } from './api-client';

export interface CalendarEventRef {
  id: string;
  projectNumber?: string;
  title?: string;
  customerNumber?: string;
  companyName?: string;
  displayName?: string;
  email?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  projectId: string | null;
  customerId: string | null;
  createdById: string | null;
  syncToGoogle: boolean;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
  project?: CalendarEventRef | null;
  customer?: CalendarEventRef | null;
  createdBy?: CalendarEventRef | null;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  projectId?: string | null;
  customerId?: string | null;
  syncToGoogle?: boolean;
}

export interface ListCalendarEventsParams {
  from?: string;
  to?: string;
  projectId?: string;
  customerId?: string;
}

export const calendarEventsApi = {
  list(params: ListCalendarEventsParams = {}): Promise<CalendarEvent[]> {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.customerId) q.set('customerId', params.customerId);
    const qs = q.toString();
    return apiClient.get<CalendarEvent[]>(
      `/calendar-events${qs ? `?${qs}` : ''}`,
    );
  },

  get(id: string): Promise<CalendarEvent> {
    return apiClient.get<CalendarEvent>(`/calendar-events/${id}`);
  },

  create(body: CalendarEventInput): Promise<CalendarEvent> {
    return apiClient.post<CalendarEvent>('/calendar-events', body);
  },

  update(
    id: string,
    body: Partial<CalendarEventInput>,
  ): Promise<CalendarEvent> {
    return apiClient.patch<CalendarEvent>(`/calendar-events/${id}`, body);
  },

  remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete<{ deleted: boolean; id: string }>(
      `/calendar-events/${id}`,
    );
  },
};
