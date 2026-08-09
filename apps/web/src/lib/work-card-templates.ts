/**
 * API-Helfer für Arbeitskarten-Templates und Kalibrierung.
 */

import { apiClient, apiUpload } from './api-client';

// ── Typen ────────────────────────────────────────────────────

/**
 * Typ/Interface `WorkCardFieldTarget` für die Web-App.
 */
export type WorkCardFieldTarget =
  | 'itemKey'
  | 'workScopeDe'
  | 'workScopeSk'
  | 'title'
  | 'floor'
  | 'room';

export const WORK_CARD_FIELD_TARGETS: WorkCardFieldTarget[] = [
  'itemKey',
  'workScopeDe',
  'workScopeSk',
  'title',
  'floor',
  'room',
];

export const FIELD_TARGET_LABELS: Record<WorkCardFieldTarget, string> = {
  itemKey: 'Kennung / Positions-ID',
  workScopeDe: 'Arbeitsinhalt (DE)',
  workScopeSk: 'Arbeitsinhalt (SK)',
  title: 'Titel',
  floor: 'Geschoss',
  room: 'Raum',
};

/** Normierte Bounding-Box relativ zur Seite (0–1). */
export interface WorkCardFieldZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Typ/Interface `WorkCardFieldMapping` für die Web-App.
 */
export interface WorkCardFieldMapping {
  target: WorkCardFieldTarget;
  labelHints: string[];
  regex?: string;
  captureLines?: number;
  /** Normierte Zone – OCR-Blöcke in der Zone werden beim Import bevorzugt. */
  zone?: WorkCardFieldZone;
}

/**
 * Typ/Interface `WorkCardTemplate` für die Web-App.
 */
export interface WorkCardTemplate {
  id: string;
  name: string;
  customerId: string | null;
  fields: WorkCardFieldMapping[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; companyName: string } | null;
}

/**
 * Typ/Interface `CalibrateResponse` für die Web-App.
 */
export interface CalibrateResponse {
  text: string;
  blocks: Array<{
    text: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  suggestedFields: Array<{
    target: string;
    labelHints: string[];
    regex?: string;
    sampleValue?: string;
  }>;
  /** PNG/JPEG data-URL der Beispielseite für den Zone-Editor */
  pageImageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Typ/Interface `CreateWorkCardTemplatePayload` für die Web-App.
 */
export interface CreateWorkCardTemplatePayload {
  name: string;
  customerId?: string;
  fields: WorkCardFieldMapping[];
  notes?: string;
}

/**
 * Typ/Interface `UpdateWorkCardTemplatePayload` für die Web-App.
 */
export interface UpdateWorkCardTemplatePayload {
  name?: string;
  customerId?: string;
  fields?: WorkCardFieldMapping[];
  notes?: string;
}

// ── API ────────────────────────────────────────────────────────

export const workCardTemplatesApi = {
  list: (customerId?: string): Promise<WorkCardTemplate[]> => {
    const params = customerId ? `?customerId=${customerId}` : '';
    return apiClient.get<WorkCardTemplate[]>(`/work-card-templates${params}`);
  },

  get: (id: string): Promise<WorkCardTemplate> =>
    apiClient.get<WorkCardTemplate>(`/work-card-templates/${id}`),

  create: (payload: CreateWorkCardTemplatePayload): Promise<WorkCardTemplate> =>
    apiClient.post<WorkCardTemplate>('/work-card-templates', payload),

  update: (id: string, payload: UpdateWorkCardTemplatePayload): Promise<WorkCardTemplate> =>
    apiClient.patch<WorkCardTemplate>(`/work-card-templates/${id}`, payload),

  remove: (id: string): Promise<unknown> =>
    apiClient.delete<unknown>(`/work-card-templates/${id}`),

  calibrate: (file: File): Promise<CalibrateResponse> => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<CalibrateResponse>('/work-card-templates/calibrate', form);
  },
};
