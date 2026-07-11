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

  async get(id: string) {
    const entry = await this.prisma.communicationEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }
    return entry;
  }

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

  async remove(id: string) {
    await this.get(id);
    await this.prisma.communicationEntry.delete({ where: { id } });
    return { id, deleted: true };
  }
}
