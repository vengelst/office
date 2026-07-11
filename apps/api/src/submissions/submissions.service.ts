import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

export interface ListSubmissionsParams {
  customerId?: string;
  status?: string;
}

/**
 * Service für die Ausschreibungsverwaltung (CRUD).
 * Ausschreibungen sind immer einem Kunden zugeordnet.
 */
@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert alle Ausschreibungen, optional gefiltert nach Kunde und Status.
   * Soft-gelöschte Einträge werden ausgeblendet.
   */
  async findAll(params: ListSubmissionsParams) {
    const where: Prisma.SubmissionWhereInput = { deletedAt: null };
    if (params.customerId) where.customerId = params.customerId;
    if (params.status) where.status = params.status as Prisma.EnumSubmissionStatusFilter;

    return this.prisma.submission.findMany({
      where,
      include: { customer: { select: { id: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lädt eine einzelne Ausschreibung mit Kundendaten.
   *
   * @param id - Ausschreibungs-UUID
   * @throws NotFoundException
   */
  async findOne(id: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, deletedAt: null },
      include: { customer: { select: { id: true, companyName: true } } },
    });
    if (!submission) {
      throw new NotFoundException('Ausschreibung nicht gefunden');
    }
    return submission;
  }

  /**
   * Erstellt eine neue Ausschreibung.
   *
   * @param dto - Ausschreibungsdaten (Titel, Kunde, etc.)
   */
  async create(dto: CreateSubmissionDto) {
    return this.prisma.submission.create({
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: { customer: { select: { id: true, companyName: true } } },
    });
  }

  /**
   * Aktualisiert eine bestehende Ausschreibung.
   *
   * @param id - Ausschreibungs-UUID
   * @param dto - Zu aktualisierende Felder
   */
  async update(id: string, dto: UpdateSubmissionDto) {
    await this.ensureExists(id);
    return this.prisma.submission.update({
      where: { id },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: { customer: { select: { id: true, companyName: true } } },
    });
  }

  /** Soft-Delete: setzt deletedAt. */
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.submission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.submission.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Ausschreibung nicht gefunden');
    }
  }
}
