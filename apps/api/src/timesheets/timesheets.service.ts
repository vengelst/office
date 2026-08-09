/**
 * Service für Timesheets.
 * Liste/Detail und Scope; Generierung und Workflow sind ausgelagert.
 */

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RoleCode,
  SignerType,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import { WorkItemsService } from '../work-items/work-items.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import {
  SORTABLE_FIELDS,
  type SortField,
  INTERNAL_ROLES,
  listSelect,
  detailInclude,
  type ListTimesheetsParams,
  type SignatureMeta,
} from './timesheet-shared';
import { TimesheetGenerationService } from './timesheet-generation.service';
import { TimesheetWorkflowService } from './timesheet-workflow.service';

export type { ListTimesheetsParams, SignatureMeta } from './timesheet-shared';

/**
 * Service für die Stundenzettel-Verwaltung (Wochenstundenzettel).
 * Scope/Liste/Detail hier; Generierung und Workflow delegiert.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
    private readonly generation: TimesheetGenerationService,
    private readonly workflow: TimesheetWorkflowService,
  ) {}

  // ── Projekt-Einschränkung für Kunden-PLs ─────────────────────

  /**
   * Projekt-Einschränkung des angemeldeten Benutzers.
   * Interne Rollen (SUPERADMIN/OFFICE/PROJECT_MANAGER) bleiben unbeschränkt;
   * ein reiner Kunden-PL sieht nur Projekte mit aktiver Zuordnung
   * (`ProjectCustomerPlAssignment`, siehe SPEZ-arbeitsitems.md 4.2).
   *
   * @param user - Angemeldeter Benutzer (JWT); ohne Angabe keine Einschränkung
   * @returns `null` = alle Projekte, sonst die erlaubten Projekt-IDs
   */
  async projectScopeFor(user?: AuthUser): Promise<string[] | null> {
    if (!user) return null;
    if (user.roles.some((role) => INTERNAL_ROLES.includes(role))) return null;
    return this.workItems.findCustomerPlProjectIds(user);
  }

  /**
   * Stellt sicher, dass der Benutzer auf den Stundenzettel zugreifen darf.
   *
   * @throws ForbiddenException wenn das Projekt nicht zugewiesen ist
   */
  async assertProjectAccess(projectId: string, user?: AuthUser): Promise<void> {
    const scope = await this.projectScopeFor(user);
    if (scope && !scope.includes(projectId)) {
      throw new ForbiddenException('Kein Zugriff auf dieses Projekt');
    }
  }

  /**
   * Detail inkl. Zugriffsprüfung (Kunden-PL nur eigene Projekte).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Stundenzettel
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  async findOneForUser(id: string, user?: AuthUser) {
    const sheet = await this.findOne(id);
    await this.assertProjectAccess(sheet.projectId, user);
    return sheet;
  }

  /**
   * Genehmigt („abzeichnen“) inkl. Zugriffsprüfung – für den Kunden-PL der einzige schreibende Stundenzettel-Vorgang neben der Unterschrift.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  async approveForUser(id: string, user: AuthUser) {
    const sheet = await this.findOne(id);
    await this.assertProjectAccess(sheet.projectId, user);
    return this.approve(id, user.type === 'user' ? user.id : null);
  }

  /**
   * Digitale Unterschrift mit Projekt-Zugriffsprüfung. Reine Kunden-PLs dürfen nur als `CUSTOMER` unterschreiben.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (SignTimesheetDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @param meta - Parameter `meta` (SignatureMeta)
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  async signForUser(
    id: string,
    dto: SignTimesheetDto,
    user: AuthUser,
    meta: SignatureMeta,
  ) {
    const sheet = await this.findOne(id);
    await this.assertProjectAccess(sheet.projectId, user);

    const isCustomerPlOnly =
      user.type === 'user' &&
      user.roles.includes(RoleCode.CUSTOMER_PL) &&
      !user.roles.some((r) =>
        (
          [
            RoleCode.SUPERADMIN,
            RoleCode.OFFICE,
            RoleCode.PROJECT_MANAGER,
          ] as string[]
        ).includes(r),
      );

    if (isCustomerPlOnly && dto.signerType !== SignerType.CUSTOMER) {
      throw new ForbiddenException(
        'Kunden-PL darf Stundenzettel nur als Kunde / Projektleiter unterschreiben',
      );
    }

    return this.sign(id, dto, meta);
  }

  // ── Liste / Detail ───────────────────────────────────────────

  /**
   * Liefert eine paginierte und filterbare Liste der Wochenstundenzettel.
   *
   * @param params - Filter (Monteur, Projekt, KW, Status), Paginierung und Sortierung
   * @param user - Angemeldeter Benutzer; schränkt einen Kunden-PL auf seine Projekte ein
   * @returns Paginierte Liste mit Stundenzettel-Übersichtsdaten
   */
  async findAll(params: ListTimesheetsParams, user?: AuthUser) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(
      params.sortBy as SortField,
    )
      ? (params.sortBy as SortField)
      : 'weekYear';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.WeeklyTimesheetWhereInput = {};
    if (params.workerId) where.workerId = params.workerId;
    if (params.projectId) where.projectId = params.projectId;
    if (params.weekYear) where.weekYear = params.weekYear;
    if (params.weekNumber) where.weekNumber = params.weekNumber;
    if (params.status) {
      const statuses = params.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is WeeklyTimesheetStatus =>
          (Object.values(WeeklyTimesheetStatus) as string[]).includes(s),
        );
      if (statuses.length) where.status = { in: statuses };
    }

    // Kunden-PL: harte Einschränkung auf zugewiesene Projekte. Ein Projektfilter
    // außerhalb des Scopes ergibt eine leere Liste statt fremder Daten.
    const scope = await this.projectScopeFor(user);
    if (scope) {
      where.projectId = {
        in: params.projectId
          ? scope.filter((id) => id === params.projectId)
          : scope,
      };
    }

    const orderBy: Prisma.WeeklyTimesheetOrderByWithRelationInput[] =
      sortBy === 'weekYear'
        ? [{ weekYear: sortDir }, { weekNumber: sortDir }]
        : [{ [sortBy]: sortDir }];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.weeklyTimesheet.findMany({
        where,
        select: listSelect,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.weeklyTimesheet.count({ where }),
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
   * Liefert einen einzelnen Stundenzettel mit Tageseinträgen und Unterschriften.
   *
   * @param id - UUID des Stundenzettels
   * @returns Vollständige Details inkl. Tagen und Signaturen
   * @throws NotFoundException wenn der Stundenzettel nicht existiert
   */
  async findOne(id: string) {
    const timesheet = await this.prisma.weeklyTimesheet.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!timesheet) {
      throw new NotFoundException('Stundenzettel nicht gefunden');
    }
    return timesheet;
  }


  // ── Generieren / Tageskorrektur (Fassade) ─────────────────────

  generate(dto: GenerateTimesheetDto) {
    return this.generation.generate(dto);
  }

  updateDay(id: string, dayId: string, dto: UpdateDayDto) {
    return this.generation.updateDay(id, dayId, dto);
  }

  // ── Workflow (Fassade) ───────────────────────────────────────

  submit(id: string) {
    return this.workflow.submit(id);
  }

  approve(id: string, userId: string | null) {
    return this.workflow.approve(id, userId);
  }

  reject(id: string, reason: string, userId: string | null) {
    return this.workflow.reject(id, reason, userId);
  }

  archive(id: string) {
    return this.workflow.archive(id);
  }

  sign(id: string, dto: SignTimesheetDto, meta: SignatureMeta) {
    return this.workflow.sign(id, dto, meta);
  }
}
