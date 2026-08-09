/**
 * Service für Backups.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BackupJobStatus,
  Prisma,
  RestoreLogStatus,
} from '@prisma/client';
import { createWriteStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_MODULES,
  isBackupModule,
  type BackupModule,
} from './backup-modules';
import { RestoreBackupDto, UpdateBackupConfigDto } from './dto/backup.dto';

/** Basisverzeichnis für Backup-Dateien (Docker-Volume). */
const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';

@Injectable()
export class BackupsService implements OnModuleInit {
  private readonly logger = new Logger(BackupsService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lifecycle-Hook: Initialisierung nach Modulstart.
   *
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async onModuleInit() {
    await fs.mkdir(BACKUP_DIR, { recursive: true }).catch(() => undefined);
    await this.ensureConfig();
  }

  /**
   * Stellt sicher, dass genau eine BackupConfig-Zeile existiert.
   *
   * @returns Konfiguration
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async ensureConfig() {
    const existing = await this.prisma.backupConfig.findFirst();
    if (existing) return existing;
    return this.prisma.backupConfig.create({
      data: {
        enabled: false,
        scheduleHour: 2,
        scheduleMinute: 0,
        retentionDays: 14,
      },
    });
  }

  /**
   * Liest die aktuelle Konfiguration.
   *
   * @returns Konfigurationsobjekt
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async getConfig() {
    return this.ensureConfig();
  }

  /**
   * Aktualisiert die Konfiguration.
   *
   * @param dto - Request-Body / Eingabedaten (UpdateBackupConfigDto)
   * @returns Aktualisierte Konfiguration
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async updateConfig(dto: UpdateBackupConfigDto) {
    const cfg = await this.ensureConfig();
    return this.prisma.backupConfig.update({
      where: { id: cfg.id },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.scheduleHour !== undefined
          ? { scheduleHour: dto.scheduleHour }
          : {}),
        ...(dto.scheduleMinute !== undefined
          ? { scheduleMinute: dto.scheduleMinute }
          : {}),
        ...(dto.retentionDays !== undefined
          ? { retentionDays: dto.retentionDays }
          : {}),
      },
    });
  }

  /**
   * Listet Backup-Jobs.
   *
   * @param limit - Seitengröße
   * @returns Jobliste
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async listJobs(limit = 50) {
    return this.prisma.backupJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Lädt einen Backup-Job anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async getJob(id: string) {
    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Backup nicht gefunden');
    return job;
  }

  /**
   * Listet Restore-Vorgänge.
   *
   * @param limit - Seitengröße
   * @returns Restore-Liste
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async listRestores(limit = 50) {
    return this.prisma.restoreLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        backupJob: { select: { id: true, filePath: true, createdAt: true } },
      },
    });
  }

  /**
   * Manuelles Full-Backup anstoßen.
   *
   * @param userId - ID (userId) (string)
   * @returns Gestarteter Job
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async startManualBackup(userId?: string) {
    return this.runBackup('manual', userId);
  }

  /**
   * Cron jede Minute: prüft, ob Schedule (Stunde/Minute) und enabled passen. Vermeidet doppelte Läufe über `running`-Flag und Status RUNNING.
   *
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */

  @Cron('* * * * *')
  async cronTick() {
    const cfg = await this.ensureConfig();
    if (!cfg.enabled) return;
    const now = new Date();
    if (
      now.getHours() !== cfg.scheduleHour ||
      now.getMinutes() !== cfg.scheduleMinute
    ) {
      return;
    }
    // Innerhalb derselben Minute nicht mehrfach starten
    const since = new Date(now.getTime() - 55_000);
    const recent = await this.prisma.backupJob.findFirst({
      where: {
        trigger: 'cron',
        createdAt: { gte: since },
      },
    });
    if (recent) return;
    await this.runBackup('cron', null);
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `runBackup` (run Backup).
   *
   * @param trigger - Parameter `trigger` ('manual' | 'cron')
   * @param userId - ID (userId) (string | null)
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async runBackup(trigger: 'manual' | 'cron', userId?: string | null) {
    if (this.running) {
      throw new BadRequestException('Ein Backup läuft bereits');
    }
    this.running = true;

    const job = await this.prisma.backupJob.create({
      data: {
        status: BackupJobStatus.PENDING,
        trigger,
        triggeredBy: userId ?? null,
      },
    });

    try {
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { status: BackupJobStatus.RUNNING, startedAt: new Date() },
      });

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
      const dirName = `office-backup-${stamp}`;
      const dir = path.join(BACKUP_DIR, dirName);
      await fs.mkdir(dir, { recursive: true });

      const moduleStats: Record<string, number> = {};
      for (const mod of BACKUP_MODULES) {
        const data = await this.exportModule(mod);
        const file = path.join(dir, `${mod}.json`);
        await fs.writeFile(file, this.safeJson(data), 'utf8');
        moduleStats[mod] = Array.isArray(data)
          ? data.length
          : typeof data === 'object' && data
            ? Object.values(data as Record<string, unknown[]>).reduce(
                (sum, v) => sum + (Array.isArray(v) ? v.length : 0),
                0,
              )
            : 1;
      }

      const manifest = {
        version: 1,
        createdAt: new Date().toISOString(),
        trigger,
        modules: BACKUP_MODULES,
        moduleStats,
      };
      await fs.writeFile(
        path.join(dir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8',
      );

      // Komprimiertes Archiv neben dem Ordner
      const archivePath = `${dir}.tar.gz`;
      await this.createTarGz(dir, archivePath);
      const stat = await fs.stat(archivePath);

      // Ordner behalten (für selektiven Restore) + Archiv
      const updated = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupJobStatus.SUCCESS,
          finishedAt: new Date(),
          filePath: dir,
          fileSize: BigInt(stat.size),
        },
      });

      await this.applyRetention();
      return this.serializeJob(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Backup fehlgeschlagen: ${message}`);
      const failed = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      return this.serializeJob(failed);
    } finally {
      this.running = false;
    }
  }

  /**
   * Löscht Backup-Job und zugehörige Dateien.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async deleteJob(id: string) {
    const job = await this.getJob(id);
    if (job.filePath) {
      await fs.rm(job.filePath, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(`${job.filePath}.tar.gz`, { force: true }).catch(() => undefined);
    }
    await this.prisma.restoreLog.updateMany({
      where: { backupJobId: id },
      data: { backupJobId: null },
    });
    await this.prisma.backupJob.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Selektiver Restore der gewählten Module aus einem Backup.
   *
   * @param jobId - ID (jobId) (string)
   * @param dto - Request-Body / Eingabedaten (RestoreBackupDto)
   * @param userId - ID (userId) (string)
   * @returns Restore-Ergebnis
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  async restore(jobId: string, dto: RestoreBackupDto, userId?: string) {
    const job = await this.getJob(jobId);
    if (job.status !== BackupJobStatus.SUCCESS || !job.filePath) {
      throw new BadRequestException('Backup ist nicht wiederherstellbar');
    }
    const modules = [...new Set(dto.modules.map((m) => m.trim()).filter(Boolean))];
    if (modules.length === 0) {
      throw new BadRequestException('Mindestens ein Modul wählen');
    }
    for (const m of modules) {
      if (!isBackupModule(m)) {
        throw new BadRequestException(`Unbekanntes Modul: ${m}`);
      }
    }

    const exists = await fs
      .access(job.filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new BadRequestException('Backup-Dateien fehlen auf dem Volume');
    }

    const log = await this.prisma.restoreLog.create({
      data: {
        backupJobId: job.id,
        status: RestoreLogStatus.RUNNING,
        modules,
        triggeredBy: userId ?? null,
        startedAt: new Date(),
      },
    });

    const details: Record<string, { ok: boolean; count?: number; error?: string }> =
      {};
    let anyOk = false;
    let anyFail = false;

    // Abhängigkeitsreihenfolge beachten
    const order = BACKUP_MODULES.filter((m) => modules.includes(m));

    for (const mod of order) {
      try {
        const file = path.join(job.filePath, `${mod}.json`);
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw) as unknown;
        const count = await this.importModule(mod, data);
        details[mod] = { ok: true, count };
        anyOk = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Restore Modul ${mod}: ${message}`);
        details[mod] = { ok: false, error: message };
        anyFail = true;
      }
    }

    const status = !anyFail
      ? RestoreLogStatus.SUCCESS
      : anyOk
        ? RestoreLogStatus.PARTIAL
        : RestoreLogStatus.FAILED;

    return this.prisma.restoreLog.update({
      where: { id: log.id },
      data: {
        status,
        finishedAt: new Date(),
        details,
        errorMessage: anyFail
          ? 'Mindestens ein Modul ist fehlgeschlagen'
          : null,
      },
    });
  }

  /**
   * Listet die für Backups verfügbaren Module.
   */
  listModules() {
    return [...BACKUP_MODULES];
  }

  // ── Export / Import ──────────────────────────────────────────

  /**
   * Interner Helfer: Interner Helfer: Implementiert `exportModule` (export Module).
   *
   * @param mod - Parameter `mod` (BackupModule)
   * @returns unknown
   */
  private async exportModule(mod: BackupModule): Promise<unknown> {
    switch (mod) {
      case 'todos':
        return this.prisma.todo.findMany();
      case 'customers':
        return {
          customers: await this.prisma.customer.findMany(),
          emails: await this.prisma.customerEmail.findMany(),
          bankAccounts: await this.prisma.customerBankAccount.findMany(),
          branches: await this.prisma.customerBranch.findMany(),
          contacts: await this.prisma.customerContact.findMany(),
          notes: await this.prisma.customerNote.findMany(),
          callLogs: await this.prisma.customerCallLog.findMany(),
        };
      case 'projects':
        return {
          projects: await this.prisma.project.findMany(),
          sites: await this.prisma.projectSite.findMany(),
          equipment: await this.prisma.projectEquipment.findMany(),
          statusHistory: await this.prisma.projectStatusHistory.findMany(),
          notes: await this.prisma.projectNote.findMany(),
          assignments: await this.prisma.projectAssignment.findMany(),
          emailRecipients: await this.prisma.projectEmailRecipient.findMany(),
        };
      case 'workers':
        return {
          workers: await this.prisma.worker.findMany(),
          languages: await this.prisma.workerLanguage.findMany(),
          certifications: await this.prisma.workerCertification.findMany(),
          pins: await this.prisma.workerPin.findMany(),
          equipmentIssues: await this.prisma.workerEquipmentIssue.findMany(),
        };
      case 'teams':
        return {
          teams: await this.prisma.workerTeam.findMany(),
          members: await this.prisma.workerTeamMember.findMany(),
        };
      case 'subcontractors':
        return {
          subcontractors: await this.prisma.subcontractor.findMany(),
          contacts: await this.prisma.subcontractorContact.findMany(),
        };
      case 'vehicles':
        return {
          vehicles: await this.prisma.vehicle.findMany(),
          assignments: await this.prisma.workerVehicleAssignment.findMany(),
        };
      case 'equipment':
        return {
          equipment: await this.prisma.equipment.findMany(),
          items: await this.prisma.equipmentItem.findMany(),
          assignments: await this.prisma.equipmentAssignment.findMany(),
        };
      case 'timesheets':
        return {
          timesheets: await this.prisma.weeklyTimesheet.findMany(),
          timeEntries: await this.prisma.timeEntry.findMany(),
        };
      case 'documents':
        return {
          folders: await this.prisma.documentFolder.findMany(),
          documents: await this.prisma.document.findMany(),
          links: await this.prisma.documentLink.findMany(),
        };
      case 'invoices':
        return {
          invoices: await this.prisma.invoice.findMany(),
          lines: await this.prisma.invoiceLine.findMany(),
          payments: await this.prisma.invoicePayment.findMany(),
        };
      default:
        return [];
    }
  }

  /**
   * Importiert Moduldaten: vorhandene Zeilen mit gleicher ID werden per upsert ersetzt. Kein Hard-Delete der gesamten Tabelle (sicherer bei Teil-Restore).
   *
   * @param mod - Parameter `mod` (BackupModule)
   * @param data - Nutzdaten
   * @returns number
   */
  private async importModule(mod: BackupModule, data: unknown): Promise<number> {
    switch (mod) {
      case 'todos': {
        const rows = data as Array<Prisma.TodoCreateManyInput>;
        let n = 0;
        for (const row of rows) {
          await this.prisma.todo.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'customers': {
        const bundle = data as {
          customers: Prisma.CustomerCreateManyInput[];
          emails: Prisma.CustomerEmailCreateManyInput[];
          bankAccounts: Prisma.CustomerBankAccountCreateManyInput[];
          branches: Prisma.CustomerBranchCreateManyInput[];
          contacts: Prisma.CustomerContactCreateManyInput[];
          notes: Prisma.CustomerNoteCreateManyInput[];
          callLogs: Prisma.CustomerCallLogCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.customers ?? []) {
          await this.prisma.customer.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.branches ?? []) {
          await this.prisma.customerBranch.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.emails ?? []) {
          await this.prisma.customerEmail.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.bankAccounts ?? []) {
          await this.prisma.customerBankAccount.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.contacts ?? []) {
          await this.prisma.customerContact.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.notes ?? []) {
          await this.prisma.customerNote.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.callLogs ?? []) {
          await this.prisma.customerCallLog.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'projects': {
        const bundle = data as {
          projects: Prisma.ProjectCreateManyInput[];
          sites: Prisma.ProjectSiteCreateManyInput[];
          equipment: Prisma.ProjectEquipmentCreateManyInput[];
          statusHistory: Prisma.ProjectStatusHistoryCreateManyInput[];
          notes: Prisma.ProjectNoteCreateManyInput[];
          assignments: Prisma.ProjectAssignmentCreateManyInput[];
          emailRecipients: Prisma.ProjectEmailRecipientCreateManyInput[];
        };
        for (const row of bundle.projects ?? []) {
          await this.prisma.project.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.sites ?? []) {
          await this.prisma.projectSite.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.equipment ?? []) {
          await this.prisma.projectEquipment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.statusHistory ?? []) {
          await this.prisma.projectStatusHistory.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.notes ?? []) {
          await this.prisma.projectNote.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.projectAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        for (const row of bundle.emailRecipients ?? []) {
          await this.prisma.projectEmailRecipient.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
        }
        return (
          (bundle.projects?.length ?? 0) +
          (bundle.sites?.length ?? 0) +
          (bundle.equipment?.length ?? 0) +
          (bundle.statusHistory?.length ?? 0) +
          (bundle.notes?.length ?? 0) +
          (bundle.assignments?.length ?? 0) +
          (bundle.emailRecipients?.length ?? 0)
        );
      }
      case 'workers': {
        const bundle = data as {
          workers: Prisma.WorkerCreateManyInput[];
          languages: Prisma.WorkerLanguageCreateManyInput[];
          certifications: Prisma.WorkerCertificationCreateManyInput[];
          pins: Prisma.WorkerPinCreateManyInput[];
          equipmentIssues: Prisma.WorkerEquipmentIssueCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.workers ?? []) {
          await this.prisma.worker.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.languages ?? []) {
          await this.prisma.workerLanguage.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.certifications ?? []) {
          await this.prisma.workerCertification.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.pins ?? []) {
          await this.prisma.workerPin.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.equipmentIssues ?? []) {
          await this.prisma.workerEquipmentIssue.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'teams': {
        const bundle = data as {
          teams: Prisma.WorkerTeamCreateManyInput[];
          members: Prisma.WorkerTeamMemberCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.teams ?? []) {
          await this.prisma.workerTeam.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.members ?? []) {
          await this.prisma.workerTeamMember.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'subcontractors': {
        const bundle = data as {
          subcontractors: Prisma.SubcontractorCreateManyInput[];
          contacts: Prisma.SubcontractorContactCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.subcontractors ?? []) {
          await this.prisma.subcontractor.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.contacts ?? []) {
          await this.prisma.subcontractorContact.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'vehicles': {
        const bundle = data as {
          vehicles: Prisma.VehicleCreateManyInput[];
          assignments: Prisma.WorkerVehicleAssignmentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.vehicles ?? []) {
          await this.prisma.vehicle.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.workerVehicleAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'equipment': {
        const bundle = data as {
          equipment: Prisma.EquipmentCreateManyInput[];
          items: Prisma.EquipmentItemCreateManyInput[];
          assignments: Prisma.EquipmentAssignmentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.items ?? []) {
          await this.prisma.equipmentItem.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.equipment ?? []) {
          await this.prisma.equipment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.assignments ?? []) {
          await this.prisma.equipmentAssignment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'timesheets': {
        const bundle = data as {
          timesheets: Prisma.WeeklyTimesheetCreateManyInput[];
          timeEntries: Prisma.TimeEntryCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.timesheets ?? []) {
          await this.prisma.weeklyTimesheet.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.timeEntries ?? []) {
          await this.prisma.timeEntry.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'documents': {
        const bundle = data as {
          folders: Prisma.DocumentFolderCreateManyInput[];
          documents: Prisma.DocumentCreateManyInput[];
          links: Prisma.DocumentLinkCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.folders ?? []) {
          await this.prisma.documentFolder.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.documents ?? []) {
          await this.prisma.document.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.links ?? []) {
          await this.prisma.documentLink.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      case 'invoices': {
        const bundle = data as {
          invoices: Prisma.InvoiceCreateManyInput[];
          lines: Prisma.InvoiceLineCreateManyInput[];
          payments: Prisma.InvoicePaymentCreateManyInput[];
        };
        let n = 0;
        for (const row of bundle.invoices ?? []) {
          await this.prisma.invoice.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.lines ?? []) {
          await this.prisma.invoiceLine.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        for (const row of bundle.payments ?? []) {
          await this.prisma.invoicePayment.upsert({
            where: { id: row.id as string },
            create: row,
            update: row,
          });
          n++;
        }
        return n;
      }
      default:
        return 0;
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `applyRetention` (apply Retention).
   */
  private async applyRetention() {
    const cfg = await this.ensureConfig();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cfg.retentionDays);
    const old = await this.prisma.backupJob.findMany({
      where: {
        createdAt: { lt: cutoff },
        status: { in: [BackupJobStatus.SUCCESS, BackupJobStatus.FAILED] },
      },
      select: { id: true, filePath: true },
    });
    for (const job of old) {
      if (job.filePath) {
        await fs.rm(job.filePath, { recursive: true, force: true }).catch(() => undefined);
        await fs.rm(`${job.filePath}.tar.gz`, { force: true }).catch(() => undefined);
      }
      await this.prisma.restoreLog.updateMany({
        where: { backupJobId: job.id },
        data: { backupJobId: null },
      });
      await this.prisma.backupJob.delete({ where: { id: job.id } }).catch(() => undefined);
    }
  }

  /**
   * Erzeugt ein einfaches gzip-Archiv der JSON-Dateien (kein echtes tar – speichert eine verkettete gzip-Datei mit Dateinamen-Headern als Fallback). Primärer Restore-Pfad bleibt das entpackte Verzeichnis.
   *
   * @param dir - Parameter `dir` (string)
   * @param archivePath - Parameter `archivePath` (string)
   */
  private async createTarGz(dir: string, archivePath: string) {
    const files = await fs.readdir(dir);
    const gzip = createGzip();
    const out = createWriteStream(archivePath);
    const pipe = pipeline(gzip, out);
    for (const name of files) {
      const content = await fs.readFile(path.join(dir, name));
      const header = Buffer.from(`\n---FILE:${name}---\n`);
      gzip.write(header);
      gzip.write(content);
    }
    gzip.end();
    await pipe;
  }

  /**
   * Serialisiert einen Backup-Job für die API.
   *
   * @returns DTO
   */
  serializeJob(job: {
    id: string;
    status: BackupJobStatus;
    trigger: string;
    triggeredBy: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    filePath: string | null;
    fileSize: bigint | null;
    errorMessage: string | null;
    createdAt: Date;
  }) {
    return {
      ...job,
      fileSize: job.fileSize != null ? Number(job.fileSize) : null,
    };
  }

  /**
   * JSON mit Date/Decimal-Unterstützung.
   *
   * @param data - Nutzdaten
   * @returns Geparstes Objekt oder Fallback (string)
   */
  private safeJson(data: unknown): string {
    return JSON.stringify(data, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { toFixed?: unknown }).toFixed === 'function' &&
        typeof (value as { toString?: unknown }).toString === 'function' &&
        (value as { constructor?: { name?: string } }).constructor?.name ===
          'Decimal'
      ) {
        return Number(value.toString());
      }
      if (typeof value === 'bigint') return Number(value);
      return value;
    });
  }
}
