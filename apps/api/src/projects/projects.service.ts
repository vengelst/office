import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, WorkerAvailability } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { CreateEmailRecipientDto } from './dto/create-email-recipient.dto';
import { UpdateEmailRecipientDto } from './dto/update-email-recipient.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

/** Sortierbare Spalten der Projektliste. */
const SORTABLE_FIELDS = [
  'projectNumber',
  'title',
  'status',
  'priority',
  'plannedStartDate',
  'createdAt',
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

export interface ListProjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  serviceType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Schlanke Projektion für die Listenansicht. */
const listSelect = {
  id: true,
  projectNumber: true,
  title: true,
  status: true,
  priority: true,
  serviceType: true,
  plannedStartDate: true,
  plannedEndDate: true,
  actualStartDate: true,
  actualEndDate: true,
  customer: { select: { id: true, companyName: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.ProjectSelect;

/** Vollständige Projektion für die Detailansicht. */
const detailInclude = {
  customer: { select: { id: true, companyName: true, customerNumber: true } },
  branch: { select: { id: true, name: true } },
  internalProjectManager: { select: { id: true, displayName: true } },
  primaryCustomerContact: {
    select: { id: true, firstName: true, lastName: true },
  },
  sites: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  equipment: { orderBy: { issuedAt: 'desc' } },
  emailRecipients: { orderBy: { recipientType: 'asc' } },
  assignments: {
    orderBy: [{ isLead: 'desc' }, { startDate: 'asc' }],
    include: {
      worker: {
        select: { id: true, workerNumber: true, firstName: true, lastName: true },
      },
    },
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    include: { changedBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.ProjectInclude;

/** Datumsfelder im DTO von ISO-Strings nach Date konvertieren. */
function coerceDate(value?: string): Date | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

/**
 * Service für die Projektverwaltung.
 * Behandelt CRUD, Status-Workflow, Standortverwaltung, Geräte,
 * E-Mail-Verteiler, Notizen und Monteur-Zuordnungen.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Projekt CRUD ─────────────────────────────────────────────

  /**
   * Liefert eine paginierte, filterbare und sortierbare Projektliste.
   *
   * @param params - Filter (Status, Kunde, Servicetyp), Suche, Paginierung und Sortierung
   * @returns Paginierte Liste mit Projekt-Übersichtsdaten
   */
  async findAll(params: ListProjectsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(params.sortBy as SortField)
      ? (params.sortBy as SortField)
      : 'createdAt';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { projectNumber: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.status) {
      const statuses = params.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is ProjectStatus =>
          (Object.values(ProjectStatus) as string[]).includes(s),
        );
      if (statuses.length) where.status = { in: statuses };
    }
    if (params.customerId) where.customerId = params.customerId;
    if (params.serviceType) {
      where.serviceType = params.serviceType as Prisma.ProjectWhereInput['serviceType'];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        select: listSelect,
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Liefert ein einzelnes Projekt mit allen verknüpften Daten.
   *
   * @param id - UUID des Projekts
   * @returns Projekt mit Standorten, Geräten, Zuordnungen, Statushistorie, etc.
   * @throws NotFoundException wenn das Projekt nicht existiert
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
    return project;
  }

  /**
   * Erstellt ein neues Projekt mit automatischer Projektnummer (P-YYYY-NNNN).
   * Protokolliert den initialen Status in der StatusHistory.
   *
   * @param dto - Projektdaten (Titel, Kunde, Termine, etc.)
   * @returns Das erstellte Projekt mit allen Relationen
   */
  async create(dto: CreateProjectDto) {
    const projectNumber = await this.generateProjectNumber();
    const project = await this.prisma.project.create({
      data: {
        ...dto,
        projectNumber,
        plannedStartDate: coerceDate(dto.plannedStartDate) ?? undefined,
        plannedEndDate: coerceDate(dto.plannedEndDate) ?? undefined,
        actualStartDate: coerceDate(dto.actualStartDate) ?? undefined,
        actualEndDate: coerceDate(dto.actualEndDate) ?? undefined,
      },
      include: detailInclude,
    });

    // Initialen Status protokollieren
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId: project.id,
        toStatus: project.status,
        comment: 'Projekt angelegt',
      },
    });

    return this.findOne(project.id);
  }

  /**
   * Aktualisiert ein bestehendes Projekt (Partial Update, ohne Statuswechsel).
   *
   * @param id - UUID des Projekts
   * @param dto - Zu aktualisierende Felder
   * @returns Das aktualisierte Projekt
   */
  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureProject(id);
    const { customerId, branchId, status, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        // Statuswechsel laufen über den dedizierten Endpoint
        customerId: customerId ?? undefined,
        branchId: branchId === undefined ? undefined : branchId || null,
        plannedStartDate: coerceDate(dto.plannedStartDate),
        plannedEndDate: coerceDate(dto.plannedEndDate),
        actualStartDate: coerceDate(dto.actualStartDate),
        actualEndDate: coerceDate(dto.actualEndDate),
      },
      include: detailInclude,
    });
  }

  /**
   * Löschen: DRAFT-Projekte werden hard-deleted,
   * andere Status bekommen Soft-Delete (deletedAt).
   */
  async remove(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
    if (project.status === ProjectStatus.DRAFT) {
      await this.prisma.$transaction([
        this.prisma.projectStatusHistory.deleteMany({ where: { projectId: id } }),
        this.prisma.projectNote.deleteMany({ where: { projectId: id } }),
        this.prisma.projectEmailRecipient.deleteMany({ where: { projectId: id } }),
        this.prisma.projectEquipment.deleteMany({ where: { projectId: id } }),
        this.prisma.projectSite.deleteMany({ where: { projectId: id } }),
        this.prisma.projectAssignment.deleteMany({ where: { projectId: id } }),
        this.prisma.project.delete({ where: { id } }),
      ]);
      return { id, deleted: true, hardDeleted: true };
    }
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true, hardDeleted: false };
  }

  // ── Status-Workflow ──────────────────────────────────────────

  /**
   * Ändert den Projektstatus und protokolliert den Wechsel in der StatusHistory.
   * Setzt automatisch actualStartDate/actualEndDate bei ACTIVE/COMPLETED.
   *
   * @param id - UUID des Projekts
   * @param dto - Neuer Status und optionaler Kommentar
   * @param userId - ID des ausführenden Benutzers (für Audit-Trail)
   * @returns Das aktualisierte Projekt
   */
  async changeStatus(id: string, dto: UpdateStatusDto, userId: string | null) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, actualStartDate: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }

    const data: Prisma.ProjectUpdateInput = { status: dto.status };
    // actualStartDate automatisch beim Wechsel auf ACTIVE (falls leer)
    if (dto.status === ProjectStatus.ACTIVE && !project.actualStartDate) {
      data.actualStartDate = new Date();
    }
    // actualEndDate automatisch beim Wechsel auf COMPLETED
    if (dto.status === ProjectStatus.COMPLETED) {
      data.actualEndDate = new Date();
    }

    await this.prisma.$transaction([
      this.prisma.project.update({ where: { id }, data }),
      this.prisma.projectStatusHistory.create({
        data: {
          projectId: id,
          fromStatus: project.status,
          toStatus: dto.status,
          changedByUserId: userId,
          comment: dto.comment,
        },
      }),
    ]);

    return this.findOne(id);
  }

  /** Erzeugt die nächste Projektnummer im Format P-YYYY-NNNN. */
  private async generateProjectNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `P-${year}-`;
    const last = await this.prisma.project.findFirst({
      where: { projectNumber: { startsWith: prefix } },
      orderBy: { projectNumber: 'desc' },
      select: { projectNumber: true },
    });
    const lastSeq = last
      ? Number.parseInt(last.projectNumber.slice(prefix.length), 10) || 0
      : 0;
    const next = (lastSeq + 1).toString().padStart(4, '0');
    return `${prefix}${next}`;
  }

  // ── Sites ────────────────────────────────────────────────────

  /**
   * Liefert alle Standorte eines Projekts.
   *
   * @param projectId - UUID des Projekts
   * @returns Array der Standorte, sortiert nach Reihenfolge
   */
  async findSites(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Erstellt einen neuen Standort für ein Projekt. */
  async createSite(projectId: string, dto: CreateSiteDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.create({ data: { ...dto, projectId } });
  }

  /** Aktualisiert einen bestehenden Standort. */
  async updateSite(projectId: string, id: string, dto: UpdateSiteDto) {
    await this.ensureSite(projectId, id);
    return this.prisma.projectSite.update({ where: { id }, data: dto });
  }

  /** Löscht einen Standort. */
  async removeSite(projectId: string, id: string) {
    await this.ensureSite(projectId, id);
    await this.prisma.projectSite.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Equipment ────────────────────────────────────────────────

  /** Liefert alle Geräte/Ausstattung eines Projekts. */
  async findEquipment(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEquipment.findMany({
      where: { projectId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Fügt ein Gerät zu einem Projekt hinzu. */
  async createEquipment(projectId: string, dto: CreateEquipmentDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectEquipment.create({
      data: {
        ...dto,
        projectId,
        issuedAt: coerceDate(dto.issuedAt) ?? undefined,
        returnedAt: coerceDate(dto.returnedAt) ?? undefined,
      },
    });
  }

  /** Aktualisiert ein bestehendes Gerät. */
  async updateEquipment(projectId: string, id: string, dto: UpdateEquipmentDto) {
    await this.ensureEquipment(projectId, id);
    return this.prisma.projectEquipment.update({
      where: { id },
      data: {
        ...dto,
        issuedAt: coerceDate(dto.issuedAt) ?? undefined,
        returnedAt: coerceDate(dto.returnedAt),
      },
    });
  }

  /** Entfernt ein Gerät aus dem Projekt. */
  async removeEquipment(projectId: string, id: string) {
    await this.ensureEquipment(projectId, id);
    await this.prisma.projectEquipment.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── E-Mail-Verteiler ─────────────────────────────────────────

  /** Liefert alle E-Mail-Verteiler-Empfänger eines Projekts. */
  async findEmailRecipients(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.findMany({
      where: { projectId },
      orderBy: { recipientType: 'asc' },
    });
  }

  /** Fügt einen neuen Empfänger zum E-Mail-Verteiler des Projekts hinzu. */
  async createEmailRecipient(projectId: string, dto: CreateEmailRecipientDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.create({
      data: { ...dto, projectId },
    });
  }

  /** Aktualisiert einen bestehenden E-Mail-Empfänger. */
  async updateEmailRecipient(
    projectId: string,
    id: string,
    dto: UpdateEmailRecipientDto,
  ) {
    await this.ensureEmailRecipient(projectId, id);
    return this.prisma.projectEmailRecipient.update({ where: { id }, data: dto });
  }

  /** Entfernt einen Empfänger aus dem E-Mail-Verteiler. */
  async removeEmailRecipient(projectId: string, id: string) {
    await this.ensureEmailRecipient(projectId, id);
    await this.prisma.projectEmailRecipient.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Notizen ──────────────────────────────────────────────────

  /** Liefert alle Notizen eines Projekts, sortiert nach Erstellungsdatum (neueste zuerst). */
  async findNotes(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  /** Erstellt eine neue Notiz für ein Projekt (mit Benutzer-Zuordnung). */
  async createNote(projectId: string, dto: CreateNoteDto, userId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.create({
      data: { projectId, body: dto.body, createdByUserId: userId },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  /** Löscht eine Projektnotiz. */
  async removeNote(projectId: string, id: string) {
    const count = await this.prisma.projectNote.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Notiz nicht gefunden');
    }
    await this.prisma.projectNote.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Monteur-Zuordnungen ──────────────────────────────────────

  /** Liefert alle Monteur-Zuordnungen eines Projekts mit Worker-Daten. */
  async findAssignments(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectAssignment.findMany({
      where: { projectId },
      orderBy: [{ isLead: 'desc' }, { startDate: 'asc' }],
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Erstellt eine neue Monteur-Zuordnung zum Projekt.
   * Setzt die Worker-Verfügbarkeit auf ON_PROJECT wenn aktiv.
   * Prüft Constraint: nur eine aktive Zuweisung pro Monteur.
   */
  async createAssignment(projectId: string, dto: CreateAssignmentDto) {
    await this.ensureProject(projectId);
    const active = dto.active ?? true;
    // Einzel-Projekt-Constraint: nur EINE aktive Zuweisung pro Monteur.
    if (active) {
      await this.assertNoActiveAssignment(dto.workerId);
    }

    const assignment = await this.prisma.projectAssignment.create({
      data: {
        projectId,
        workerId: dto.workerId,
        roleName: dto.roleName,
        startDate: coerceDate(dto.startDate) ?? new Date(),
        endDate: coerceDate(dto.endDate) ?? undefined,
        active,
        isLead: dto.isLead ?? false,
        notes: dto.notes,
      },
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Verfügbarkeit auf "im Projekteinsatz" setzen.
    if (active) {
      await this.setWorkerAvailability(
        dto.workerId,
        WorkerAvailability.ON_PROJECT,
      );
    }
    return assignment;
  }

  /**
   * Aktualisiert eine Monteur-Zuordnung und synchronisiert die Verfügbarkeit.
   * Bei Deaktivierung → AVAILABLE, bei Reaktivierung → ON_PROJECT.
   */
  async updateAssignment(
    projectId: string,
    id: string,
    dto: UpdateAssignmentDto,
  ) {
    const current = await this.prisma.projectAssignment.findFirst({
      where: { id, projectId },
      select: { id: true, workerId: true, active: true },
    });
    if (!current) {
      throw new NotFoundException('Zuordnung nicht gefunden');
    }

    const { workerId, ...rest } = dto;
    const targetWorkerId = workerId ?? current.workerId;
    // Reaktivierung einer Zuweisung → Constraint erneut prüfen.
    if (dto.active === true && !current.active) {
      await this.assertNoActiveAssignment(targetWorkerId, id);
    }

    const updated = await this.prisma.projectAssignment.update({
      where: { id },
      data: {
        ...rest,
        workerId: workerId ?? undefined,
        startDate: coerceDate(dto.startDate) ?? undefined,
        endDate: coerceDate(dto.endDate),
      },
      include: {
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Verfügbarkeit synchronisieren: Ende → AVAILABLE, Start → ON_PROJECT.
    if (dto.active === false && current.active) {
      await this.setWorkerAvailability(
        current.workerId,
        WorkerAvailability.AVAILABLE,
      );
    } else if (dto.active === true && !current.active) {
      await this.setWorkerAvailability(
        targetWorkerId,
        WorkerAvailability.ON_PROJECT,
      );
    }
    return updated;
  }

  /** Löscht eine Zuordnung und setzt ggf. den Monteur auf AVAILABLE. */
  async removeAssignment(projectId: string, id: string) {
    const current = await this.prisma.projectAssignment.findFirst({
      where: { id, projectId },
      select: { id: true, workerId: true, active: true },
    });
    if (!current) {
      throw new NotFoundException('Zuordnung nicht gefunden');
    }
    await this.prisma.projectAssignment.delete({ where: { id } });
    // War die Zuweisung aktiv, Monteur wieder verfügbar machen.
    if (current.active) {
      await this.setWorkerAvailability(
        current.workerId,
        WorkerAvailability.AVAILABLE,
      );
    }
    return { id, deleted: true };
  }

  /**
   * Stellt sicher, dass der Monteur keine andere aktive Zuweisung hat.
   * Wirft 409 mit Hinweis auf das belegende Projekt.
   */
  private async assertNoActiveAssignment(
    workerId: string,
    exceptAssignmentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.projectAssignment.findFirst({
      where: {
        workerId,
        active: true,
        id: exceptAssignmentId ? { not: exceptAssignmentId } : undefined,
      },
      include: { project: { select: { title: true } } },
    });
    if (existing) {
      throw new ConflictException(
        `Worker ist bereits dem Projekt '${existing.project.title}' zugewiesen. Bitte zuerst die bestehende Zuweisung beenden.`,
      );
    }
  }

  /** Setzt die Verfügbarkeit eines Monteurs (für Zuweisungs-Workflow). */
  private async setWorkerAvailability(
    workerId: string,
    availability: WorkerAvailability,
  ): Promise<void> {
    await this.prisma.worker
      .update({ where: { id: workerId }, data: { availability } })
      .catch(() => undefined);
  }

  // ── Kalender / Timeline ──────────────────────────────────────

  /**
   * Liefert Projekte für die Kalender-/Timeline-Ansicht.
   * Filtert nach Zeitraum-Überlappung, Kunde und optionalem Aktivstatus.
   *
   * @param from - Beginn des Anzeige-Zeitraums (ISO-String)
   * @param to - Ende des Anzeige-Zeitraums (ISO-String)
   * @param customerId - Optional: nur Projekte eines Kunden
   * @param activeOnly - Nur aktive Projekte anzeigen
   * @returns Array von Projekten mit Timeline-relevanten Feldern
   */
  async timeline(from?: string, to?: string, customerId?: string, activeOnly?: boolean) {
    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (customerId) where.customerId = customerId;
    if (activeOnly) where.status = ProjectStatus.ACTIVE;

    // Überlappung mit [from, to]: Projekte mit Start/End im oder um den Zeitraum.
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (fromDate || toDate) {
      where.AND = [
        toDate ? { plannedStartDate: { lte: toDate } } : {},
        fromDate
          ? {
              OR: [
                { plannedEndDate: { gte: fromDate } },
                { plannedEndDate: null },
              ],
            }
          : {},
      ];
    }

    return this.prisma.project.findMany({
      where,
      select: {
        id: true,
        projectNumber: true,
        title: true,
        status: true,
        priority: true,
        plannedStartDate: true,
        plannedEndDate: true,
        actualStartDate: true,
        actualEndDate: true,
        customer: { select: { id: true, companyName: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { plannedStartDate: 'asc' },
    });
  }

  // ── Meta (Dropdown-Daten) ────────────────────────────────────

  /** Aktive Benutzer für das "Interner Projektleiter"-Dropdown. */
  async listUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /** Aktive Monteure für die Zuordnungs-Auswahl. */
  async listWorkers() {
    return this.prisma.worker.findMany({
      where: { active: true },
      select: { id: true, workerNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  private async ensureProject(id: string): Promise<void> {
    const count = await this.prisma.project.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
  }

  private async ensureSite(projectId: string, id: string): Promise<void> {
    const count = await this.prisma.projectSite.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Standort nicht gefunden');
    }
  }

  private async ensureEquipment(projectId: string, id: string): Promise<void> {
    const count = await this.prisma.projectEquipment.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Gerät nicht gefunden');
    }
  }

  private async ensureEmailRecipient(
    projectId: string,
    id: string,
  ): Promise<void> {
    const count = await this.prisma.projectEmailRecipient.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Empfänger nicht gefunden');
    }
  }

}
