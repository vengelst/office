import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';

/** Sortierbare Spalten der Subunternehmen-Liste. */
const SORTABLE_FIELDS = ['name', 'city', 'createdAt'] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

export interface ListSubcontractorsParams {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Service für die Subunternehmen-Verwaltung.
 * Behandelt CRUD mit Soft-Delete und liefert zugehörige
 * Monteure in der Detailansicht.
 */
@Injectable()
export class SubcontractorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert eine paginierte und filterbare Liste aller Subunternehmen.
   *
   * @param params - Filter (aktiv, Suche), Paginierung und Sortierung
   * @returns Paginierte Liste mit Monteur-Anzahl pro Sub
   */
  async findAll(params: ListSubcontractorsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(params.sortBy as SortField)
      ? (params.sortBy as SortField)
      : 'name';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.SubcontractorWhereInput = { deletedAt: null };
    if (params.active !== undefined) where.active = params.active;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.subcontractor.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
        include: {
          _count: { select: { workers: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.subcontractor.count({ where }),
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
   * Liefert ein einzelnes Subunternehmen mit zugehörigen Monteuren.
   *
   * @param id - UUID des Subunternehmens
   * @returns Sub-Details mit Monteur-Liste
   * @throws NotFoundException wenn das Sub nicht existiert
   */
  async findOne(id: string) {
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
      include: {
        workers: {
          where: { deletedAt: null },
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
            availability: true,
            photoPath: true,
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
      },
    });
    if (!subcontractor) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }
    return subcontractor;
  }

  /** Erstellt ein neues Subunternehmen. */
  async create(dto: CreateSubcontractorDto) {
    return this.prisma.subcontractor.create({ data: { ...dto } });
  }

  /** Aktualisiert ein bestehendes Subunternehmen. */
  async update(id: string, dto: UpdateSubcontractorDto) {
    await this.ensureExists(id);
    return this.prisma.subcontractor.update({
      where: { id },
      data: { ...dto },
    });
  }

  /** Soft-Delete: setzt deletedAt. */
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.subcontractor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.subcontractor.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }
  }
}
