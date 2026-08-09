/**
 * Service für Subcontractors.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { CreateSubcontractorContactDto } from './dto/create-subcontractor-contact.dto';
import { UpdateSubcontractorContactDto } from './dto/update-subcontractor-contact.dto';

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
 * Monteure sowie Ansprechpartner in der Detailansicht.
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
   * Liefert ein einzelnes Subunternehmen mit Monteuren und Kontakten.
   *
   * @param id - UUID des Subunternehmens
   * @returns Sub-Details mit Monteur- und Kontakt-Liste
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
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { lastName: 'asc' },
            { firstName: 'asc' },
          ],
        },
      },
    });
    if (!subcontractor) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }
    return subcontractor;
  }

  /**
   * Erstellt ein neues Subunternehmen.
   *
   * @param dto - Request-Body / Eingabedaten (CreateSubcontractorDto)
   * @returns Neu angelegter Datensatz
   */
  async create(dto: CreateSubcontractorDto) {
    return this.prisma.subcontractor.create({ data: { ...dto } });
  }

  /**
   * Aktualisiert ein bestehendes Subunternehmen.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSubcontractorDto)
   * @returns Aktualisierter Datensatz
   */
  async update(id: string, dto: UpdateSubcontractorDto) {
    await this.ensureExists(id);
    return this.prisma.subcontractor.update({
      where: { id },
      data: { ...dto },
    });
  }

  /**
   * Soft-Delete: setzt deletedAt.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.subcontractor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /**
   * Mehrfach-Löschen: ruft remove() je ID auf.
   *
   * @param ids - Liste von IDs (string[])
   * @returns Ergebnis der Massenlöschung
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

  // ── Kontakte ─────────────────────────────────────────────────

  /**
   * Listet Kontakte der Entität.
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @returns Kontakt-Liste
   */
  async listContacts(subcontractorId: string) {
    await this.ensureExists(subcontractorId);
    return this.prisma.subcontractorContact.findMany({
      where: { subcontractorId },
      orderBy: [
        { isPrimary: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });
  }

  /**
   * Legt einen Kontakt an.
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param dto - Request-Body / Eingabedaten (CreateSubcontractorContactDto)
   * @returns Neuer Kontakt
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async createContact(
    subcontractorId: string,
    dto: CreateSubcontractorContactDto,
  ) {
    await this.ensureExists(subcontractorId);
    if (dto.isPrimary) {
      await this.clearPrimary(subcontractorId);
    }
    return this.prisma.subcontractorContact.create({
      data: { ...dto, subcontractorId },
    });
  }

  /**
   * Aktualisiert einen Kontakt.
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param contactId - ID (contactId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSubcontractorContactDto)
   * @returns Aktualisierter Kontakt
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async updateContact(
    subcontractorId: string,
    contactId: string,
    dto: UpdateSubcontractorContactDto,
  ) {
    await this.ensureContact(subcontractorId, contactId);
    if (dto.isPrimary) {
      await this.clearPrimary(subcontractorId, contactId);
    }
    return this.prisma.subcontractorContact.update({
      where: { id: contactId },
      data: { ...dto },
    });
  }

  /**
   * Entfernt einen Kontakt.
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param contactId - ID (contactId) (string)
   * @returns Ergebnis
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async removeContact(subcontractorId: string, contactId: string) {
    await this.ensureContact(subcontractorId, contactId);
    await this.prisma.subcontractorContact.delete({ where: { id: contactId } });
    return { id: contactId, deleted: true };
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `clearPrimary` (clear Primary).
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param exceptId - ID (exceptId) (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async clearPrimary(
    subcontractorId: string,
    exceptId?: string,
  ): Promise<void> {
    await this.prisma.subcontractorContact.updateMany({
      where: {
        subcontractorId,
        isPrimary: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isPrimary: false },
    });
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureExists` (ensure Exists).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.subcontractor.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureContact` (ensure Contact).
   *
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param contactId - ID (contactId) (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async ensureContact(
    subcontractorId: string,
    contactId: string,
  ): Promise<void> {
    const count = await this.prisma.subcontractorContact.count({
      where: { id: contactId, subcontractorId },
    });
    if (count === 0) {
      throw new NotFoundException('Kontakt nicht gefunden');
    }
  }
}
