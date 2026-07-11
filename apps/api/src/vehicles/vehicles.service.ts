import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';

/** Sortierbare Spalten der Fahrzeug-Liste. */
const SORTABLE_FIELDS = [
  'licensePlate',
  'internalName',
  'category',
  'nextInspection',
  'insuranceExpiry',
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

/** Worker-Felder, die für Zuweisungsanzeigen benötigt werden. */
const WORKER_SELECT = {
  id: true,
  workerNumber: true,
  firstName: true,
  lastName: true,
  photoPath: true,
} satisfies Prisma.WorkerSelect;

export interface ListVehiclesParams {
  page?: number;
  limit?: number;
  search?: string;
  ownerType?: string;
  category?: string;
  subcontractorId?: string;
  active?: boolean;
  /** Filter auf Zuweisungsstatus: 'assigned' | 'available' */
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Service für die Fahrzeugverwaltung.
 * Behandelt CRUD, Zuweisungen an Monteure, Ablaufwarnungen
 * (TÜV/Versicherung) und die Zuweisungshistorie.
 */
@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert eine paginierte, filterbare und sortierbare Fahrzeugliste.
   * Inkludiert die aktuelle Monteur-Zuweisung.
   *
   * @param params - Filter (Eigentümer, Kategorie, Status), Suche und Paginierung
   * @returns Paginierte Liste mit Fahrzeug-Daten und aktueller Zuweisung
   */
  async findAll(params: ListVehiclesParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(
      params.sortBy as SortField,
    )
      ? (params.sortBy as SortField)
      : 'licensePlate';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.VehicleWhereInput = {};
    if (params.active !== undefined) where.active = params.active;
    if (params.ownerType) where.ownerType = params.ownerType;
    if (params.category) where.category = params.category;
    if (params.subcontractorId) where.subcontractorId = params.subcontractorId;
    if (params.status === 'assigned') {
      where.assignments = { some: { assignedTo: null } };
    } else if (params.status === 'available') {
      where.assignments = { none: { assignedTo: null } };
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { licensePlate: { contains: q, mode: 'insensitive' } },
        { internalName: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
        include: {
          subcontractor: { select: { id: true, name: true } },
          assignments: {
            where: { assignedTo: null },
            include: { worker: { select: WORKER_SELECT } },
            orderBy: { assignedFrom: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    const data = rows.map((v) => {
      const { assignments, ...rest } = v;
      return { ...rest, currentAssignment: assignments[0] ?? null };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fahrzeuge mit TÜV/Versicherung, die innerhalb von `windowDays` Tagen
   * ablaufen (oder bereits abgelaufen sind). Nur aktive Fahrzeuge.
   */
  async findExpiring(windowDays = 30) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + windowDays);

    return this.prisma.vehicle.findMany({
      where: {
        active: true,
        OR: [
          { nextInspection: { lte: threshold } },
          { insuranceExpiry: { lte: threshold } },
        ],
      },
      select: {
        id: true,
        licensePlate: true,
        internalName: true,
        make: true,
        model: true,
        nextInspection: true,
        insuranceExpiry: true,
      },
      orderBy: { nextInspection: 'asc' },
    });
  }

  /** Aktive Monteure für Zuweisungs-Auswahl. */
  listWorkers() {
    return this.prisma.worker.findMany({
      where: { active: true, deletedAt: null },
      select: WORKER_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /**
   * Liefert ein einzelnes Fahrzeug mit aktueller Zuweisung und Historie.
   *
   * @param id - UUID des Fahrzeugs
   * @returns Fahrzeug-Details mit Zuweisungshistorie
   * @throws NotFoundException wenn das Fahrzeug nicht existiert
   */
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        subcontractor: { select: { id: true, name: true, city: true } },
        assignments: {
          include: { worker: { select: WORKER_SELECT } },
          orderBy: [{ assignedTo: 'asc' }, { assignedFrom: 'desc' }],
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Fahrzeug nicht gefunden');

    const { assignments, ...rest } = vehicle;
    const currentAssignment =
      assignments.find((a) => a.assignedTo === null) ?? null;
    const history = assignments.filter((a) => a.assignedTo !== null);

    return { ...rest, assignments, currentAssignment, history };
  }

  /** Erstellt ein neues Fahrzeug in der Datenbank. */
  async create(dto: CreateVehicleDto) {
    const data = this.toData(dto) as Prisma.VehicleUncheckedCreateInput;
    data.licensePlate = dto.licensePlate;
    return this.prisma.vehicle.create({ data });
  }

  /** Aktualisiert ein bestehendes Fahrzeug. */
  async update(id: string, dto: UpdateVehicleDto) {
    await this.ensureExists(id);
    const data = this.toData(dto);
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  /** Deaktivieren: setzt active=false. */
  async deactivate(id: string) {
    await this.ensureExists(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { active: false },
    });
    return { id, deactivated: true };
  }

  /** Reaktivieren: setzt active=true. */
  async reactivate(id: string) {
    await this.ensureExists(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { active: true },
    });
    return { id, reactivated: true };
  }

  /**
   * Löschen: Hard-Delete wenn keine Zuweisungshistorie,
   * sonst Deaktivierung als Fallback.
   */
  async remove(id: string) {
    await this.ensureExists(id);
    const assignmentCount = await this.prisma.workerVehicleAssignment.count({
      where: { vehicleId: id },
    });
    if (assignmentCount > 0) {
      await this.prisma.vehicle.update({
        where: { id },
        data: { active: false },
      });
      return { id, deleted: false, deactivated: true };
    }
    await this.prisma.vehicle.delete({ where: { id } });
    return { id, deleted: true, deactivated: false };
  }

  /**
   * Weist das Fahrzeug einem Monteur zu. Eine bestehende offene Zuweisung
   * wird automatisch beendet (assignedTo = now), bevor die neue erstellt wird.
   */
  async assign(id: string, dto: AssignVehicleDto) {
    await this.ensureExists(id);

    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.workerId, deletedAt: null },
      select: { id: true },
    });
    if (!worker) throw new BadRequestException('Monteur nicht gefunden');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.workerVehicleAssignment.updateMany({
        where: { vehicleId: id, assignedTo: null },
        data: { assignedTo: now },
      }),
      this.prisma.workerVehicleAssignment.create({
        data: {
          vehicleId: id,
          workerId: dto.workerId,
          assignedFrom: now,
          notes: dto.notes?.trim() || null,
        },
      }),
    ]);

    return this.findOne(id);
  }

  /** Beendet die aktuell offene Zuweisung (assignedTo = now). */
  async unassign(id: string) {
    await this.ensureExists(id);
    const open = await this.prisma.workerVehicleAssignment.findFirst({
      where: { vehicleId: id, assignedTo: null },
    });
    if (!open) {
      throw new BadRequestException('Keine offene Zuweisung vorhanden');
    }
    await this.prisma.workerVehicleAssignment.update({
      where: { id: open.id },
      data: { assignedTo: new Date() },
    });
    return this.findOne(id);
  }

  // ── Helfer ─────────────────────────────────────────────────────

  /**
   * Übersetzt das DTO in Prisma-Daten: setzt nur definierte Felder,
   * konvertiert Datumsstrings und räumt die Sub-Referenz bei eigenen
   * Fahrzeugen auf.
   */
  private toData(
    dto: CreateVehicleDto | UpdateVehicleDto,
  ): Prisma.VehicleUncheckedUpdateInput {
    const data: Prisma.VehicleUncheckedUpdateInput = {};
    const set = <K extends keyof typeof dto>(key: K): void => {
      if (dto[key] !== undefined) {
        (data as Record<string, unknown>)[key as string] = dto[key];
      }
    };

    set('make');
    set('model');
    set('internalName');
    set('ownerType');
    set('subcontractorId');
    set('category');
    set('year');
    set('vin');
    set('color');
    set('fuelType');
    set('notes');
    set('active');
    if (dto.licensePlate !== undefined) data.licensePlate = dto.licensePlate;

    // Datumsfelder konvertieren
    if (dto.nextInspection !== undefined) {
      data.nextInspection = dto.nextInspection
        ? new Date(dto.nextInspection)
        : null;
    }
    if (dto.insuranceExpiry !== undefined) {
      data.insuranceExpiry = dto.insuranceExpiry
        ? new Date(dto.insuranceExpiry)
        : null;
    }
    // Sub-Referenz nur bei Sub-Fahrzeug behalten
    if (dto.ownerType === 'OWN') {
      data.subcontractorId = null;
    }
    return data;
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Fahrzeug nicht gefunden');
  }
}
