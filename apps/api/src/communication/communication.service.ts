import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

export interface ListCommunicationParams {
  entityType?: string;
  entityId?: string;
  contactId?: string;
  type?: string;
}

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: ListCommunicationParams) {
    const where: Record<string, unknown> = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;
    if (params.contactId) where.contactId = params.contactId;
    if (params.type) where.type = params.type;

    return this.prisma.communicationEntry.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.communicationEntry.findUnique({
      where: { id },
    });
    if (!entry) throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    return entry;
  }

  async create(dto: CreateCommunicationDto) {
    return this.prisma.communicationEntry.create({
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCommunicationDto) {
    await this.ensureExists(id);
    return this.prisma.communicationEntry.update({
      where: { id },
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.communicationEntry.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.communicationEntry.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Kommunikationseintrag nicht gefunden');
    }
  }
}
