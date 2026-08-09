/**
 * Service für Projects.
 * CRUD, Status, Timeline; Ressourcen/Zuordnungen sind ausgelagert.
 */

import {
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
import {
  SORTABLE_FIELDS,
  type SortField,
  type ListProjectsParams,
  listSelect,
  detailInclude,
  coerceDate,
} from './project-shared';
import { ProjectResourcesService } from './project-resources.service';
import { ProjectAssignmentsService } from './project-assignments.service';

export type { ListProjectsParams } from './project-shared';

/**
 * Service für die Projektverwaltung.
 * Behandelt CRUD und Status; Sites/Equipment/Notes und Assignments delegiert.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ProjectResourcesService,
    private readonly assignments: ProjectAssignmentsService,
  ) {}

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
    await this.resources.ensureProject(id);
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
   * Löschen: DRAFT-Projekte werden hard-deleted, andere Status bekommen Soft-Delete (deletedAt).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
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

  /**
   * Mehrfach-Löschen: ruft remove() je ID auf.
   *
   * @param ids - Liste von IDs (string[])
   * @returns Ergebnis der Massenlöschung
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async bulkRemove(ids: string[]) {
    const results = [];
    const errors = [];
    for (const id of ids) {
      try {
        results.push(await this.remove(id));
      } catch (err) {
        errors.push({
          id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { deleted: results.length, failed: errors.length, results, errors };
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

  /**
   * Erzeugt die nächste Projektnummer im Format P-YYYY-NNNN.
   *
   * @returns string
   */
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


  // ── Sites / Equipment / E-Mail / Notizen (Fassade) ───────────

  findSites(projectId: string) {
    return this.resources.findSites(projectId);
  }
  createSite(projectId: string, dto: CreateSiteDto) {
    return this.resources.createSite(projectId, dto);
  }
  updateSite(projectId: string, id: string, dto: UpdateSiteDto) {
    return this.resources.updateSite(projectId, id, dto);
  }
  removeSite(projectId: string, id: string) {
    return this.resources.removeSite(projectId, id);
  }
  findEquipment(projectId: string) {
    return this.resources.findEquipment(projectId);
  }
  createEquipment(projectId: string, dto: CreateEquipmentDto) {
    return this.resources.createEquipment(projectId, dto);
  }
  updateEquipment(projectId: string, id: string, dto: UpdateEquipmentDto) {
    return this.resources.updateEquipment(projectId, id, dto);
  }
  removeEquipment(projectId: string, id: string) {
    return this.resources.removeEquipment(projectId, id);
  }
  findEmailRecipients(projectId: string) {
    return this.resources.findEmailRecipients(projectId);
  }
  createEmailRecipient(projectId: string, dto: CreateEmailRecipientDto) {
    return this.resources.createEmailRecipient(projectId, dto);
  }
  updateEmailRecipient(projectId: string, id: string, dto: UpdateEmailRecipientDto) {
    return this.resources.updateEmailRecipient(projectId, id, dto);
  }
  removeEmailRecipient(projectId: string, id: string) {
    return this.resources.removeEmailRecipient(projectId, id);
  }
  findNotes(projectId: string) {
    return this.resources.findNotes(projectId);
  }
  createNote(projectId: string, dto: CreateNoteDto, userId: string) {
    return this.resources.createNote(projectId, dto, userId);
  }
  removeNote(projectId: string, id: string) {
    return this.resources.removeNote(projectId, id);
  }

  // ── Zuordnungen (Fassade) ────────────────────────────────────

  findAssignments(projectId: string) {
    return this.assignments.findAssignments(projectId);
  }
  createAssignment(projectId: string, dto: CreateAssignmentDto) {
    return this.assignments.createAssignment(projectId, dto);
  }
  updateAssignment(projectId: string, id: string, dto: UpdateAssignmentDto) {
    return this.assignments.updateAssignment(projectId, id, dto);
  }
  removeAssignment(projectId: string, id: string) {
    return this.assignments.removeAssignment(projectId, id);
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

  /**
   * Aktive Benutzer für das "Interner Projektleiter"-Dropdown.
   *
   * @returns Benutzer-Liste
   */
  async listUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /**
   * Aktive Monteure für die Zuordnungs-Auswahl. Liefert immer Availability-Metadaten; availableOnly filtert auf freie.
   *
   * @returns Monteur-Liste
   */
  async listWorkers(params?: {
    from?: string;
    to?: string;
    availableOnly?: boolean;
  }) {
    const fromDate = params?.from
      ? new Date(params.from.slice(0, 10) + 'T00:00:00.000Z')
      : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const toDate = params?.to
      ? new Date(params.to.slice(0, 10) + 'T23:59:59.999Z')
      : new Date('9999-12-31T23:59:59.999Z');

    const workers = await this.prisma.worker.findMany({
      where: { active: true, deletedAt: null },
      select: {
        id: true,
        workerNumber: true,
        firstName: true,
        lastName: true,
        availability: true,
        assignments: {
          where: {
            active: true,
            startDate: { lte: toDate },
            OR: [{ endDate: null }, { endDate: { gte: fromDate } }],
          },
          take: 1,
          orderBy: { startDate: 'desc' },
          select: {
            project: { select: { title: true } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const blockedStatuses: WorkerAvailability[] = [
      WorkerAvailability.SICK,
      WorkerAvailability.VACATION,
      WorkerAvailability.UNAVAILABLE,
    ];

    const mapped = workers.map((w) => {
      const blocking = w.assignments[0]?.project.title ?? null;
      const statusBlocked = blockedStatuses.includes(w.availability);
      const available = !statusBlocked && !blocking;
      return {
        id: w.id,
        workerNumber: w.workerNumber,
        firstName: w.firstName,
        lastName: w.lastName,
        availability: w.availability,
        available,
        blockingProjectTitle: blocking,
      };
    });

    // Freie zuerst, dann alphabetisch (bereits sortiert).
    mapped.sort((a, b) => Number(b.available) - Number(a.available));

    if (params?.availableOnly) {
      return mapped.filter((w) => w.available);
    }
    return mapped;
  }
}

