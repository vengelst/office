/**
 * Service für Communication.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunicationEntityType,
  CommunicationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

export interface ListCommunicationParams {
  entityType?: CommunicationEntityType;
  entityId?: string;
  contactId?: string;
  type?: CommunicationType;
  createdBy?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface EnrichedCommunicationEntry {
  id: string;
  entityType: CommunicationEntityType;
  entityId: string;
  contactId: string | null;
  type: CommunicationType;
  direction: string;
  subject: string | null;
  content: string;
  occurredAt: Date;
  duration: number | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  entityName: string | null;
  contactName: string | null;
  createdByName: string | null;
}

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listet Einträge der Domäne (Entity optional → globale Übersicht).
   */
  async list(params: ListCommunicationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CommunicationEntryWhereInput = {};

    if (params.entityType) {
      where.entityType = params.entityType;
    }
    if (params.entityId) {
      where.entityId = params.entityId;
    }
    if (params.contactId) {
      where.contactId = params.contactId;
    }
    if (params.type) {
      where.type = params.type;
    }
    if (params.createdBy) {
      where.createdBy = params.createdBy;
    }
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = new Date(params.from);
      if (params.to) where.occurredAt.lte = new Date(params.to);
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.communicationEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.communicationEntry.count({ where }),
    ]);

    const data = await this.enrich(rows);
    return { data, total, page, limit };
  }

  /**
   * Liest einen einzelnen Eintrag inkl. Anzeigenamen.
   */
  async get(id: string): Promise<EnrichedCommunicationEntry> {
    const entry = await this.prisma.communicationEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }
    const [enriched] = await this.enrich([entry]);
    return enriched;
  }

  /**
   * Legt einen neuen Datensatz an.
   */
  async create(dto: CreateCommunicationDto, createdBy?: string) {
    await this.assertEntityExists(dto.entityType, dto.entityId);
    await this.assertContactBelongs(dto.entityType, dto.entityId, dto.contactId);

    const entry = await this.prisma.communicationEntry.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        contactId: dto.contactId || null,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        content: dto.content,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        duration: dto.duration,
        createdBy: createdBy || null,
      },
    });
    const [enriched] = await this.enrich([entry]);
    return enriched;
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   */
  async update(id: string, dto: UpdateCommunicationDto) {
    const existing = await this.prisma.communicationEntry.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }

    const entityType = dto.entityType ?? existing.entityType;
    const entityId = dto.entityId ?? existing.entityId;
    const contactId =
      dto.contactId !== undefined ? dto.contactId || null : existing.contactId;

    if (dto.entityType || dto.entityId) {
      await this.assertEntityExists(entityType, entityId);
    }
    if (
      dto.contactId !== undefined ||
      dto.entityType !== undefined ||
      dto.entityId !== undefined
    ) {
      await this.assertContactBelongs(entityType, entityId, contactId ?? undefined);
    }

    const entry = await this.prisma.communicationEntry.update({
      where: { id },
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        contactId: dto.contactId !== undefined ? dto.contactId || null : undefined,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        content: dto.content,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        duration: dto.duration,
      },
    });
    const [enriched] = await this.enrich([entry]);
    return enriched;
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   */
  async remove(id: string) {
    const existing = await this.prisma.communicationEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }
    await this.prisma.communicationEntry.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Autoren für Filter (User-IDs aus CommunicationEntry.createdBy).
   */
  async listAuthors() {
    const rows = await this.prisma.communicationEntry.findMany({
      where: { createdBy: { not: null } },
      distinct: ['createdBy'],
      select: { createdBy: true },
    });
    const ids = rows
      .map((r) => r.createdBy)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });
    return users;
  }

  private async assertEntityExists(
    entityType: CommunicationEntityType,
    entityId: string,
  ) {
    if (entityType === 'CUSTOMER') {
      const c = await this.prisma.customer.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { id: true },
      });
      if (!c) throw new BadRequestException('Kunde nicht gefunden');
      return;
    }
    if (entityType === 'SUBCONTRACTOR') {
      const s = await this.prisma.subcontractor.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { id: true },
      });
      if (!s) throw new BadRequestException('Subunternehmer nicht gefunden');
      return;
    }
    const w = await this.prisma.worker.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { id: true },
    });
    if (!w) throw new BadRequestException('Monteur nicht gefunden');
  }

  private async assertContactBelongs(
    entityType: CommunicationEntityType,
    entityId: string,
    contactId?: string | null,
  ) {
    if (!contactId) return;

    if (entityType === 'CUSTOMER') {
      const contact = await this.prisma.customerContact.findUnique({
        where: { id: contactId },
        select: { customerId: true },
      });
      if (!contact || contact.customerId !== entityId) {
        throw new BadRequestException(
          'Kontakt gehört nicht zu diesem Kunden',
        );
      }
      return;
    }

    if (entityType === 'SUBCONTRACTOR') {
      const contact = await this.prisma.subcontractorContact.findUnique({
        where: { id: contactId },
        select: { subcontractorId: true },
      });
      if (!contact || contact.subcontractorId !== entityId) {
        throw new BadRequestException(
          'Kontakt gehört nicht zu diesem Subunternehmer',
        );
      }
      return;
    }

    // WORKER: kein separates Kontaktmodell – contactId nicht erlaubt
    throw new BadRequestException(
      'Kontaktperson ist für Monteure nicht vorgesehen',
    );
  }

  private async enrich(
    rows: Array<{
      id: string;
      entityType: CommunicationEntityType;
      entityId: string;
      contactId: string | null;
      type: CommunicationType;
      direction: string;
      subject: string | null;
      content: string;
      occurredAt: Date;
      duration: number | null;
      createdBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ): Promise<EnrichedCommunicationEntry[]> {
    if (rows.length === 0) return [];

    const customerIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'CUSTOMER')
          .map((r) => r.entityId),
      ),
    ];
    const subIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'SUBCONTRACTOR')
          .map((r) => r.entityId),
      ),
    ];
    const workerIds = [
      ...new Set(
        rows.filter((r) => r.entityType === 'WORKER').map((r) => r.entityId),
      ),
    ];
    const customerContactIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'CUSTOMER' && r.contactId)
          .map((r) => r.contactId as string),
      ),
    ];
    const subContactIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'SUBCONTRACTOR' && r.contactId)
          .map((r) => r.contactId as string),
      ),
    ];
    const authorIds = [
      ...new Set(
        rows.map((r) => r.createdBy).filter((id): id is string => Boolean(id)),
      ),
    ];

    const [customers, subs, workers, customerContacts, subContacts, authors] =
      await Promise.all([
        customerIds.length
          ? this.prisma.customer.findMany({
              where: { id: { in: customerIds } },
              select: { id: true, companyName: true, customerNumber: true },
            })
          : Promise.resolve([]),
        subIds.length
          ? this.prisma.subcontractor.findMany({
              where: { id: { in: subIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        workerIds.length
          ? this.prisma.worker.findMany({
              where: { id: { in: workerIds } },
              select: { id: true, firstName: true, lastName: true, workerNumber: true },
            })
          : Promise.resolve([]),
        customerContactIds.length
          ? this.prisma.customerContact.findMany({
              where: { id: { in: customerContactIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : Promise.resolve([]),
        subContactIds.length
          ? this.prisma.subcontractorContact.findMany({
              where: { id: { in: subContactIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : Promise.resolve([]),
        authorIds.length
          ? this.prisma.user.findMany({
              where: { id: { in: authorIds } },
              select: { id: true, displayName: true },
            })
          : Promise.resolve([]),
      ]);

    const customerMap = new Map(
      customers.map((c) => [
        c.id,
        c.companyName || c.customerNumber || c.id,
      ]),
    );
    const subMap = new Map(subs.map((s) => [s.id, s.name]));
    const workerMap = new Map(
      workers.map((w) => [
        w.id,
        `${w.firstName} ${w.lastName}`.trim() || w.workerNumber || w.id,
      ]),
    );
    const contactMap = new Map<string, string>();
    for (const c of customerContacts) {
      contactMap.set(c.id, `${c.firstName} ${c.lastName}`.trim());
    }
    for (const c of subContacts) {
      contactMap.set(c.id, `${c.firstName} ${c.lastName}`.trim());
    }
    const authorMap = new Map(authors.map((a) => [a.id, a.displayName]));

    return rows.map((row) => {
      let entityName: string | null = null;
      if (row.entityType === 'CUSTOMER') {
        entityName = customerMap.get(row.entityId) ?? null;
      } else if (row.entityType === 'SUBCONTRACTOR') {
        entityName = subMap.get(row.entityId) ?? null;
      } else {
        entityName = workerMap.get(row.entityId) ?? null;
      }
      return {
        ...row,
        entityName,
        contactName: row.contactId
          ? contactMap.get(row.contactId) ?? null
          : null,
        createdByName: row.createdBy
          ? authorMap.get(row.createdBy) ?? null
          : null,
      };
    });
  }
}
