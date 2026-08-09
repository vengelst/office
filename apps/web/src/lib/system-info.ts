/**
 * API-Helfer für Systeminfo und Paket-Updates.
 */

import { apiClient } from './api-client';

/**
 * Typ/Interface `SystemCpu` für die Web-App.
 */
export interface SystemCpu {
  model: string;
  cores: number;
  usagePercent: number;
  loadAvg: number[];
}

/**
 * Typ/Interface `SystemMemory` für die Web-App.
 */
export interface SystemMemory {
  total: string;
  used: string;
  free: string;
  usagePercent: number;
}

/**
 * Typ/Interface `DiskBreakdownItem` für die Web-App.
 */
export interface DiskBreakdownItem {
  label: string;
  size: string;
  sizeBytes: number;
}

/**
 * Typ/Interface `SystemDisk` für die Web-App.
 */
export interface SystemDisk {
  total: string;
  used: string;
  available: string;
  usagePercent: number;
  breakdown: DiskBreakdownItem[];
}

/**
 * Typ/Interface `NetworkInterface` für die Web-App.
 */
export interface NetworkInterface {
  name: string;
  rx: string;
  tx: string;
}

/**
 * Typ/Interface `ProcessInfo` für die Web-App.
 */
export interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

/**
 * Typ/Interface `SystemMetrics` für die Web-App.
 */
export interface SystemMetrics {
  cpu: SystemCpu;
  memory: SystemMemory;
  disk: SystemDisk;
  network: NetworkInterface[];
  uptime: string;
  server: {
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  processes: ProcessInfo[];
  processSource: 'host' | 'container';
  osUsers: string[];
}

/**
 * Typ/Interface `DatabaseTable` für die Web-App.
 */
export interface DatabaseTable {
  name: string;
  size: string;
  sizeBytes: number;
  rows: number;
}

/**
 * Typ/Interface `DatabaseMetrics` für die Web-App.
 */
export interface DatabaseMetrics {
  size: string;
  activeConnections: number;
  maxConnections: number;
  cacheHitRatio: number | null;
  tables: DatabaseTable[];
  version: string;
  error?: string;
}

/**
 * Typ/Interface `StorageBucket` für die Web-App.
 */
export interface StorageBucket {
  name: string;
  objects: number;
  size: string;
  sizeBytes: number;
}

/**
 * Typ/Interface `StorageMetrics` für die Web-App.
 */
export interface StorageMetrics {
  available: boolean;
  totalSize: string;
  totalObjects: number;
  buckets: StorageBucket[];
  error?: string;
}

/**
 * Typ/Interface `ServiceHealth` für die Web-App.
 */
export interface ServiceHealth {
  name: string;
  status: 'online' | 'offline';
  responseTime?: number;
  error?: string;
}

/**
 * Typ/Interface `ServiceHealthMap` für die Web-App.
 */
export interface ServiceHealthMap {
  api: ServiceHealth;
  postgresql: ServiceHealth;
  minio: ServiceHealth;
  ocr: ServiceHealth;
  research: ServiceHealth;
}

/**
 * Typ/Interface `OsUpdateInfo` für die Web-App.
 */
export interface OsUpdateInfo {
  count: number;
  packages: string[];
}

/**
 * Typ/Interface `OsUpdates` für die Web-App.
 */
export interface OsUpdates {
  container: OsUpdateInfo;
  host: {
    available: boolean;
    count: number;
    packages: string[];
  };
}

/**
 * Typ/Interface `AppStats` für die Web-App.
 */
export interface AppStats {
  customers: number;
  projects: number;
  workers: number;
  openTodos: number;
  equipment: {
    assigned: number;
    available: number;
  };
  communicationRecent: number;
  documents: number;
  error?: string;
}

/**
 * Typ/Interface `DockerContainer` für die Web-App.
 */
export interface DockerContainer {
  name: string;
  memUsage: string;
  memLimit: string;
  memPercent: string;
}

/**
 * Typ/Interface `DockerMemory` für die Web-App.
 */
export interface DockerMemory {
  available: boolean;
  containers: DockerContainer[];
}

/**
 * Typ/Interface `MemoryProcess` für die Web-App.
 */
export interface MemoryProcess {
  pid: string;
  user: string;
  mem: string;
  rss: string;
  command: string;
}

/**
 * Typ/Interface `SystemInfo` für die Web-App.
 */
export interface SystemInfo {
  system: SystemMetrics;
  database: DatabaseMetrics;
  storage: StorageMetrics;
  services: ServiceHealthMap;
  osUpdates: OsUpdates;
  appStats: AppStats;
  dockerMemory: DockerMemory;
  memoryProcesses: MemoryProcess[];
}

/**
 * API-/UI-Helfer `fetchSystemInfo` (fetch System Info).
 *
 * @returns SystemInfo
 */
export async function fetchSystemInfo(): Promise<SystemInfo> {
  return apiClient.get<SystemInfo>('/system-info');
}

/**
 * API-/UI-Helfer `triggerPackageUpdate` (trigger Package Update).
 *
 * @returns Promise<
 */
export async function triggerPackageUpdate(): Promise<{
  success: boolean;
  output: string;
}> {
  return apiClient.post('/system-info/update-packages', {});
}
