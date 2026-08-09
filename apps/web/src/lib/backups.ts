/**
 * API-Helfer für Backup-Konfiguration, Jobs und Restores.
 */

import { apiClient } from './api-client';

export const BACKUP_MODULE_LABELS: Record<string, string> = {
  todos: 'To-Dos',
  customers: 'Kunden',
  projects: 'Projekte',
  workers: 'Monteure',
  teams: 'Teams',
  subcontractors: 'Subunternehmen',
  vehicles: 'Fahrzeuge',
  equipment: 'Equipment',
  timesheets: 'Stundenzettel',
  documents: 'Dokumente',
  invoices: 'Rechnungen',
};

/**
 * Typ/Interface `BackupConfig` für die Web-App.
 */
export interface BackupConfig {
  id: string;
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Typ/Interface `BackupJob` für die Web-App.
 */
export interface BackupJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  trigger: string;
  triggeredBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  createdAt: string;
}

/**
 * Typ/Interface `RestoreLog` für die Web-App.
 */
export interface RestoreLog {
  id: string;
  backupJobId: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  modules: string[];
  triggeredBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  details: Record<string, { ok: boolean; count?: number; error?: string }> | null;
  createdAt: string;
  backupJob?: { id: string; filePath: string | null; createdAt: string } | null;
}

export const backupsApi = {
  getConfig: () => apiClient.get<BackupConfig>('/backups/config'),
  updateConfig: (body: Partial<BackupConfig>) =>
    apiClient.patch<BackupConfig>('/backups/config', body),
  listJobs: (limit = 50) =>
    apiClient.get<BackupJob[]>(`/backups?limit=${limit}`),
  startBackup: () => apiClient.post<BackupJob>('/backups', {}),
  getJob: (id: string) => apiClient.get<BackupJob>(`/backups/${id}`),
  deleteJob: (id: string) =>
    apiClient.delete<{ id: string; deleted: boolean }>(`/backups/${id}`),
  restore: (id: string, modules: string[]) =>
    apiClient.post<RestoreLog>(`/backups/${id}/restore`, { modules }),
  listRestores: (limit = 50) =>
    apiClient.get<RestoreLog[]>(`/backups/restores?limit=${limit}`),
  listModules: () =>
    apiClient.get<{ modules: string[] }>('/backups/modules'),
};
