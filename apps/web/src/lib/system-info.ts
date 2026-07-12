import { apiClient } from './api-client';

export interface SystemCpu {
  model: string;
  cores: number;
  usagePercent: number;
  loadAvg: number[];
}

export interface SystemMemory {
  total: string;
  used: string;
  free: string;
  usagePercent: number;
}

export interface DiskBreakdownItem {
  label: string;
  size: string;
  sizeBytes: number;
}

export interface SystemDisk {
  total: string;
  used: string;
  available: string;
  usagePercent: number;
  breakdown: DiskBreakdownItem[];
}

export interface NetworkInterface {
  name: string;
  rx: string;
  tx: string;
}

export interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

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
  osUsers: string[];
}

export interface DatabaseTable {
  name: string;
  size: string;
  sizeBytes: number;
  rows: number;
}

export interface DatabaseMetrics {
  size: string;
  activeConnections: number;
  maxConnections: number;
  cacheHitRatio: number | null;
  tables: DatabaseTable[];
  version: string;
  error?: string;
}

export interface StorageBucket {
  name: string;
  objects: number;
  size: string;
  sizeBytes: number;
}

export interface StorageMetrics {
  available: boolean;
  totalSize: string;
  totalObjects: number;
  buckets: StorageBucket[];
  error?: string;
}

export interface ServiceHealth {
  name: string;
  status: 'online' | 'offline';
  responseTime?: number;
  error?: string;
}

export interface ServiceHealthMap {
  api: ServiceHealth;
  postgresql: ServiceHealth;
  minio: ServiceHealth;
  ocr: ServiceHealth;
  research: ServiceHealth;
}

export interface OsUpdateInfo {
  count: number;
  packages: string[];
}

export interface OsUpdates {
  container: OsUpdateInfo;
  host: {
    available: boolean;
    count: number;
    packages: string[];
  };
}

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

export interface SystemInfo {
  system: SystemMetrics;
  database: DatabaseMetrics;
  storage: StorageMetrics;
  services: ServiceHealthMap;
  osUpdates: OsUpdates;
  appStats: AppStats;
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  return apiClient.get<SystemInfo>('/system-info');
}

export async function triggerPackageUpdate(): Promise<{
  success: boolean;
  output: string;
}> {
  return apiClient.post('/system-info/update-packages', {});
}
