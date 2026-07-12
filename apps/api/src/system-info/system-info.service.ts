import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Client as MinioClient } from 'minio';
import * as os from 'os';
import { execSync } from 'child_process';
import * as fs from 'fs';

@Injectable()
export class SystemInfoService {
  private readonly logger = new Logger(SystemInfoService.name);
  private readonly minioClient: MinioClient;
  private readonly ocrServiceUrl: string;
  private readonly researchServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.minioClient = new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT') ?? 'minio',
      port: Number(this.config.get<string>('MINIO_PORT') ?? 9000),
      useSSL:
        (this.config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey:
        this.config.get<string>('MINIO_ACCESS_KEY') ?? 'office_minio',
      secretKey:
        this.config.get<string>('MINIO_SECRET_KEY') ?? 'office_minio_pw',
    });

    this.ocrServiceUrl =
      this.config.get<string>('OCR_SERVICE_URL') ??
      'http://ocr-service:8000';
    this.researchServiceUrl =
      this.config.get<string>('RESEARCH_SERVICE_URL') ??
      'http://research-service:8000';
  }

  async getSystemInfo() {
    const [
      system,
      database,
      storage,
      services,
      osUpdates,
      appStats,
    ] = await Promise.all([
      this.getSystemMetrics(),
      this.getDatabaseMetrics(),
      this.getStorageMetrics(),
      this.getServiceHealth(),
      this.getOsUpdates(),
      this.getAppStats(),
    ]);

    return { system, database, storage, services, osUpdates, appStats };
  }

  private async getSystemMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    let cpuUsagePercent = 0;
    try {
      const stat = fs.readFileSync('/proc/stat', 'utf-8');
      const cpuLine = stat.split('\n')[0];
      const parts = cpuLine.split(/\s+/).slice(1).map(Number);
      const idle = parts[3];
      const total = parts.reduce((a, b) => a + b, 0);
      cpuUsagePercent = ((total - idle) / total) * 100;
    } catch {
      const avgLoad = loadAvg[0];
      cpuUsagePercent = Math.min((avgLoad / cpus.length) * 100, 100);
    }

    let disk: {
      total: string;
      used: string;
      available: string;
      usagePercent: number;
      breakdown: { label: string; size: string; sizeBytes: number }[];
    } = { total: '', used: '', available: '', usagePercent: 0, breakdown: [] };
    try {
      const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf-8' }).trim();
      const parts = dfOutput.split(/\s+/);
      disk.total = parts[1];
      disk.used = parts[2];
      disk.available = parts[3];
      disk.usagePercent = parseInt(parts[4]) || 0;

      const dfBytes = execSync('df / | tail -1', { encoding: 'utf-8' }).trim();
      const bParts = dfBytes.split(/\s+/);
      const totalBytes = (parseInt(bParts[1]) || 0) * 1024;
      const usedBytes = (parseInt(bParts[2]) || 0) * 1024;

      const duDirs = [
        { path: '/app', label: 'Applikation' },
        { path: '/var/log', label: 'Logs' },
        { path: '/tmp', label: 'Temp' },
      ];

      const breakdown: { label: string; size: string; sizeBytes: number }[] = [];
      let knownBytes = 0;

      for (const dir of duDirs) {
        try {
          const duOut = execSync(`du -sb ${dir.path} 2>/dev/null | cut -f1`, {
            encoding: 'utf-8',
            timeout: 5000,
          }).trim();
          const bytes = parseInt(duOut) || 0;
          if (bytes > 0) {
            breakdown.push({ label: dir.label, size: this.formatBytes(bytes), sizeBytes: bytes });
            knownBytes += bytes;
          }
        } catch { /* skip */ }
      }

      const osSystemBytes = Math.max(0, usedBytes - knownBytes);
      if (osSystemBytes > 0) {
        breakdown.unshift({
          label: 'Betriebssystem & Pakete',
          size: this.formatBytes(osSystemBytes),
          sizeBytes: osSystemBytes,
        });
      }

      const freeBytes = Math.max(0, totalBytes - usedBytes);
      if (freeBytes > 0) {
        breakdown.push({
          label: 'Frei',
          size: this.formatBytes(freeBytes),
          sizeBytes: freeBytes,
        });
      }

      disk.breakdown = breakdown;
    } catch (e) {
      this.logger.warn(`Disk info not available: ${(e as Error).message}`);
    }

    let network: { name: string; rx: string; tx: string }[] = [];
    try {
      const netDev = fs.readFileSync('/proc/net/dev', 'utf-8');
      const lines = netDev.split('\n').slice(2);
      network = lines
        .filter((l) => l.trim())
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const name = parts[0].replace(':', '');
          const rxBytes = parseInt(parts[1]) || 0;
          const txBytes = parseInt(parts[9]) || 0;
          return {
            name,
            rx: this.formatBytes(rxBytes),
            tx: this.formatBytes(txBytes),
          };
        })
        .filter((n) => n.name !== 'lo');
    } catch {
      const interfaces = os.networkInterfaces();
      network = Object.entries(interfaces)
        .filter(([name]) => name !== 'lo')
        .map(([name]) => ({ name, rx: 'N/A', tx: 'N/A' }));
    }

    const uptimeSec = os.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const uptime = `${days}d ${hours}h ${minutes}m`;

    let processes: {
      pid: string;
      user: string;
      cpu: string;
      mem: string;
      command: string;
    }[] = [];
    try {
      const topOutput = execSync('top -bn1 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const lines = topOutput.split('\n');
      const headerIdx = lines.findIndex((l) => l.includes('PID'));
      if (headerIdx >= 0) {
        const procLines = lines.slice(headerIdx + 1).filter((l) => l.trim());
        processes = procLines.slice(0, 10).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[0] ?? '',
            user: parts[2] ?? parts[1] ?? '',
            cpu: parts.find((_, i) => lines[headerIdx]?.split(/\s+/)[i] === '%CPU') ?? parts[7] ?? '0',
            mem: parts.find((_, i) => lines[headerIdx]?.split(/\s+/)[i] === '%VSZ') ?? parts[5] ?? '0',
            command: parts.slice(8).join(' ').substring(0, 80) || parts[parts.length - 1] ?? '',
          };
        });
      }
      if (processes.length === 0) {
        const topOutput2 = execSync('top -bn1 2>/dev/null | tail -n +8 | head -10', {
          encoding: 'utf-8',
          timeout: 5000,
        });
        processes = topOutput2
          .trim()
          .split('\n')
          .filter((l) => l.trim())
          .map((line) => {
            const p = line.trim().split(/\s+/);
            return {
              pid: p[0] ?? '',
              user: p[2] ?? '',
              cpu: p[7] ?? '0',
              mem: p[5] ?? '0',
              command: p.slice(8).join(' ').substring(0, 80),
            };
          });
      }
    } catch {
      try {
        const psOut = execSync('ps -o pid,user,pcpu,pmem,comm 2>/dev/null || ps aux 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 5000,
        });
        const psLines = psOut.trim().split('\n').slice(1);
        processes = psLines.slice(0, 10).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[0] ?? '',
            user: parts[1] ?? '',
            cpu: parts[2] ?? '0',
            mem: parts[3] ?? '0',
            command: parts.slice(4).join(' ').substring(0, 80),
          };
        });
      } catch (e2) {
        this.logger.warn(`Process list not available: ${(e2 as Error).message}`);
      }
    }

    let osUsers: string[] = [];
    try {
      const whoOutput = execSync('who 2>/dev/null', { encoding: 'utf-8' });
      osUsers = whoOutput
        .trim()
        .split('\n')
        .filter((l) => l.trim());
    } catch {
      /* Container hat ggf. kein 'who' */
    }
    if (osUsers.length === 0) {
      try {
        const passwd = fs.readFileSync('/etc/passwd', 'utf-8');
        osUsers = passwd
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('#'))
          .filter((l) => {
            const uid = parseInt(l.split(':')[2]);
            return uid >= 1000 || uid === 0;
          })
          .map((l) => l.split(':')[0]);
      } catch {
        /* ignore */
      }
    }

    return {
      cpu: {
        model: cpus[0]?.model ?? 'Unknown',
        cores: cpus.length,
        usagePercent: Math.round(cpuUsagePercent * 10) / 10,
        loadAvg: loadAvg.map((v) => Math.round(v * 100) / 100),
      },
      memory: {
        total: this.formatBytes(totalMem),
        used: this.formatBytes(usedMem),
        free: this.formatBytes(freeMem),
        usagePercent: Math.round(memUsagePercent * 10) / 10,
      },
      disk,
      network,
      uptime,
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
      processes,
      osUsers,
    };
  }

  private async getDatabaseMetrics() {
    try {
      const [
        sizeResult,
        activeResult,
        maxResult,
        cacheResult,
        tablesResult,
        versionResult,
      ] = await Promise.all([
        this.prisma.$queryRawUnsafe<{ size: string }[]>(
          `SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
        ),
        this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`,
        ),
        this.prisma.$queryRawUnsafe<{ max_connections: string }[]>(
          `SHOW max_connections`,
        ),
        this.prisma.$queryRawUnsafe<{ ratio: number | null }[]>(
          `SELECT sum(heap_blks_hit)::float / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as ratio FROM pg_statio_user_tables`,
        ),
        this.prisma.$queryRawUnsafe<
          {
            name: string;
            size: string;
            size_bytes: bigint;
            rows: bigint;
          }[]
        >(
          `SELECT relname as name,
                  pg_size_pretty(pg_total_relation_size(C.oid)) as size,
                  pg_total_relation_size(C.oid) as size_bytes,
                  reltuples::bigint as rows
           FROM pg_class C
           LEFT JOIN pg_namespace N ON N.oid = C.relnamespace
           WHERE nspname = 'public' AND relkind = 'r'
           ORDER BY pg_total_relation_size(C.oid) DESC
           LIMIT 15`,
        ),
        this.prisma.$queryRawUnsafe<{ version: string }[]>(
          `SELECT version()`,
        ),
      ]);

      return {
        size: sizeResult[0]?.size ?? 'N/A',
        activeConnections: Number(activeResult[0]?.count ?? 0),
        maxConnections: parseInt(maxResult[0]?.max_connections ?? '100'),
        cacheHitRatio:
          cacheResult[0]?.ratio != null
            ? Math.round(cacheResult[0].ratio * 100) / 100
            : null,
        tables: tablesResult.map((t) => ({
          name: t.name,
          size: t.size,
          sizeBytes: Number(t.size_bytes),
          rows: Number(t.rows),
        })),
        version: versionResult[0]?.version ?? 'N/A',
      };
    } catch (e) {
      this.logger.error(`Database metrics failed: ${(e as Error).message}`);
      return {
        size: 'N/A',
        activeConnections: 0,
        maxConnections: 0,
        cacheHitRatio: null,
        tables: [],
        version: 'N/A',
        error: (e as Error).message,
      };
    }
  }

  private async getStorageMetrics() {
    try {
      const buckets = await this.minioClient.listBuckets();
      const bucketDetails: {
        name: string;
        objects: number;
        size: string;
        sizeBytes: number;
      }[] = [];

      let totalObjects = 0;
      let totalSizeBytes = 0;

      for (const bucket of buckets) {
        let objects = 0;
        let sizeBytes = 0;

        await new Promise<void>((resolve, reject) => {
          const stream = this.minioClient.listObjectsV2(
            bucket.name,
            '',
            true,
          );
          stream.on('data', (obj) => {
            objects++;
            sizeBytes += obj.size ?? 0;
          });
          stream.on('end', () => resolve());
          stream.on('error', (err) => reject(err));
        });

        totalObjects += objects;
        totalSizeBytes += sizeBytes;
        bucketDetails.push({
          name: bucket.name,
          objects,
          size: this.formatBytes(sizeBytes),
          sizeBytes,
        });
      }

      return {
        available: true,
        totalSize: this.formatBytes(totalSizeBytes),
        totalObjects,
        buckets: bucketDetails,
      };
    } catch (e) {
      this.logger.warn(`MinIO metrics failed: ${(e as Error).message}`);
      return {
        available: false,
        totalSize: '0 B',
        totalObjects: 0,
        buckets: [],
        error: (e as Error).message,
      };
    }
  }

  private async getServiceHealth() {
    const checkService = async (
      name: string,
      url: string,
    ): Promise<{
      name: string;
      status: 'online' | 'offline';
      responseTime?: number;
      error?: string;
    }> => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const responseTime = Date.now() - start;
        return {
          name,
          status: res.ok ? 'online' : 'offline',
          responseTime,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
      } catch (e) {
        return {
          name,
          status: 'offline',
          responseTime: Date.now() - start,
          error: (e as Error).message,
        };
      }
    };

    const dbHealth = await (async () => {
      const start = Date.now();
      try {
        await this.prisma.$queryRawUnsafe('SELECT 1');
        return {
          name: 'PostgreSQL',
          status: 'online' as const,
          responseTime: Date.now() - start,
        };
      } catch (e) {
        return {
          name: 'PostgreSQL',
          status: 'offline' as const,
          responseTime: Date.now() - start,
          error: (e as Error).message,
        };
      }
    })();

    const minioHealth = await (async () => {
      const start = Date.now();
      try {
        await this.minioClient.listBuckets();
        return {
          name: 'MinIO',
          status: 'online' as const,
          responseTime: Date.now() - start,
        };
      } catch (e) {
        return {
          name: 'MinIO',
          status: 'offline' as const,
          responseTime: Date.now() - start,
          error: (e as Error).message,
        };
      }
    })();

    const [ocrHealth, researchHealth] = await Promise.all([
      checkService('OCR Service', `${this.ocrServiceUrl}/health`),
      checkService('Research Service', `${this.researchServiceUrl}/health`),
    ]);

    return {
      api: { name: 'API', status: 'online' as const, responseTime: 0 },
      postgresql: dbHealth,
      minio: minioHealth,
      ocr: ocrHealth,
      research: researchHealth,
    };
  }

  private async getOsUpdates() {
    let containerUpdates: { count: number; packages: string[] } = {
      count: 0,
      packages: [],
    };

    try {
      execSync('apk update 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 15000,
      });
      const output = execSync('apk list --upgradable 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const packages = output
        .trim()
        .split('\n')
        .filter((l) => l.trim() && l.includes('upgradable'));
      containerUpdates = { count: packages.length, packages };
    } catch {
      containerUpdates = { count: 0, packages: [] };
    }

    let hostUpdates: { available: boolean; count: number; packages: string[] } =
      { available: false, count: 0, packages: [] };

    try {
      if (fs.existsSync('/host/var/lib/apt/')) {
        const output = execSync(
          'chroot /host apt list --upgradable 2>/dev/null',
          { encoding: 'utf-8', timeout: 15000 },
        );
        const packages = output
          .trim()
          .split('\n')
          .filter((l) => l.includes('upgradable'));
        hostUpdates = { available: true, count: packages.length, packages };
      }
    } catch {
      /* Host-Zugriff nicht verfügbar */
    }

    return { container: containerUpdates, host: hostUpdates };
  }

  private async getAppStats() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        customers,
        projects,
        workers,
        openTodos,
        equipmentAssigned,
        equipmentAvailable,
        communicationRecent,
        documents,
      ] = await Promise.all([
        this.prisma.customer.count({ where: { deletedAt: null } }),
        this.prisma.project.count({ where: { deletedAt: null } }),
        this.prisma.worker.count({ where: { deletedAt: null } }),
        this.prisma.todo.count({
          where: {
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
        }),
        this.prisma.equipment.count({
          where: { status: 'ASSIGNED', deletedAt: null },
        }),
        this.prisma.equipment.count({
          where: { status: 'AVAILABLE', deletedAt: null },
        }),
        this.prisma.communicationEntry.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.document.count(),
      ]);

      return {
        customers,
        projects,
        workers,
        openTodos,
        equipment: { assigned: equipmentAssigned, available: equipmentAvailable },
        communicationRecent,
        documents,
      };
    } catch (e) {
      this.logger.error(`App stats failed: ${(e as Error).message}`);
      return {
        customers: 0,
        projects: 0,
        workers: 0,
        openTodos: 0,
        equipment: { assigned: 0, available: 0 },
        communicationRecent: 0,
        documents: 0,
        error: (e as Error).message,
      };
    }
  }

  async updatePackages(): Promise<{ success: boolean; output: string }> {
    try {
      const output = execSync('apk upgrade --no-cache 2>&1', {
        encoding: 'utf-8',
        timeout: 120000,
      });
      return { success: true, output };
    } catch (e) {
      return {
        success: false,
        output: (e as Error).message,
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
}
