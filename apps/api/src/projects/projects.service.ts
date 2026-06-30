import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
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

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Projekt CRUD ─────────────────────────────────────────────

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

  /** Soft-Delete: setzt deletedAt. */
  async remove(id: string) {
    await this.ensureProject(id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  // ── Status-Workflow ──────────────────────────────────────────

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

  async findSites(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createSite(projectId: string, dto: CreateSiteDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectSite.create({ data: { ...dto, projectId } });
  }

  async updateSite(projectId: string, id: string, dto: UpdateSiteDto) {
    await this.ensureSite(projectId, id);
    return this.prisma.projectSite.update({ where: { id }, data: dto });
  }

  async removeSite(projectId: string, id: string) {
    await this.ensureSite(projectId, id);
    await this.prisma.projectSite.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Equipment ────────────────────────────────────────────────

  async findEquipment(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEquipment.findMany({
      where: { projectId },
      orderBy: { issuedAt: 'desc' },
    });
  }

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

  async removeEquipment(projectId: string, id: string) {
    await this.ensureEquipment(projectId, id);
    await this.prisma.projectEquipment.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── E-Mail-Verteiler ─────────────────────────────────────────

  async findEmailRecipients(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.findMany({
      where: { projectId },
      orderBy: { recipientType: 'asc' },
    });
  }

  async createEmailRecipient(projectId: string, dto: CreateEmailRecipientDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectEmailRecipient.create({
      data: { ...dto, projectId },
    });
  }

  async updateEmailRecipient(
    projectId: string,
    id: string,
    dto: UpdateEmailRecipientDto,
  ) {
    await this.ensureEmailRecipient(projectId, id);
    return this.prisma.projectEmailRecipient.update({ where: { id }, data: dto });
  }

  async removeEmailRecipient(projectId: string, id: string) {
    await this.ensureEmailRecipient(projectId, id);
    await this.prisma.projectEmailRecipient.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Notizen ──────────────────────────────────────────────────

  async findNotes(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

  async createNote(projectId: string, dto: CreateNoteDto, userId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectNote.create({
      data: { projectId, body: dto.body, createdByUserId: userId },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  }

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

  async createAssignment(projectId: string, dto: CreateAssignmentDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectAssignment.create({
      data: {
        projectId,
        workerId: dto.workerId,
        roleName: dto.roleName,
        startDate: coerceDate(dto.startDate) ?? new Date(),
        endDate: coerceDate(dto.endDate) ?? undefined,
        active: dto.active ?? true,
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
  }

  async updateAssignment(
    projectId: string,
    id: string,
    dto: UpdateAssignmentDto,
  ) {
    await this.ensureAssignment(projectId, id);
    const { workerId, ...rest } = dto;
    return this.prisma.projectAssignment.update({
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
  }

  async removeAssignment(projectId: string, id: string) {
    await this.ensureAssignment(projectId, id);
    await this.prisma.projectAssignment.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Kalender / Timeline ──────────────────────────────────────

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

  private async ensureAssignment(projectId: string, id: string): Promise<void> {
    const count = await this.prisma.projectAssignment.count({
      where: { id, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Zuordnung nicht gefunden');
    }
  }
}
