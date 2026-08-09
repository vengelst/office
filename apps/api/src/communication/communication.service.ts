/**
 * Service für Communication.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
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
  page?: number;
  limit?: number;
}

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listet Einträge der Domäne.
   *
   * @param params - Filter-, Sortier- und/oder Pagination-Parameter (ListCommunicationParams)
   * @returns Liste
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
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

    const [data, total] = await this.prisma.$transaction([
      this.prisma.communicationEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.communicationEntry.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Liest einen Konfigurations- oder Datensatzwert.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Gelesener Wert
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async get(id: string) {
    const entry = await this.prisma.communicationEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }
    return entry;
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateCommunicationDto)
   * @returns Neu angelegter Datensatz
   */
  async create(dto: CreateCommunicationDto) {
    return this.prisma.communicationEntry.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        contactId: dto.contactId,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        content: dto.content,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        duration: dto.duration,
      },
    });
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateCommunicationDto)
   * @returns Aktualisierter Datensatz
   */
  async update(id: string, dto: UpdateCommunicationDto) {
    await this.get(id);
    return this.prisma.communicationEntry.update({
      where: { id },
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */
  async remove(id: string) {
    await this.get(id);
    await this.prisma.communicationEntry.delete({ where: { id } });
    return { id, deleted: true };
  }
}
