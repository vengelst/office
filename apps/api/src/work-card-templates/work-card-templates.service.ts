/**
 * Service für Work Card Templates.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkCardTemplateDto,
  UpdateWorkCardTemplateDto,
} from './dto/work-card-template.dto';

@Injectable()
export class WorkCardTemplatesService {
  private readonly logger = new Logger(WorkCardTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param customerId - ID des Kunden (string)
   * @returns Listenergebnis
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async findAll(customerId?: string) {
    const where = customerId ? { customerId } : {};
    return this.prisma.workCardTemplate.findMany({
      where,
      include: { customer: { select: { id: true, companyName: true } } },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async findOne(id: string) {
    const tpl = await this.prisma.workCardTemplate.findUnique({
      where: { id },
      include: { customer: { select: { id: true, companyName: true } } },
    });
    if (!tpl) throw new NotFoundException(`Template ${id} nicht gefunden`);
    return tpl;
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateWorkCardTemplateDto)
   * @returns Neu angelegter Datensatz
   */
  async create(dto: CreateWorkCardTemplateDto) {
    return this.prisma.workCardTemplate.create({
      data: {
        name: dto.name,
        customerId: dto.customerId ?? null,
        fields: dto.fields as any,
        notes: dto.notes ?? null,
      },
      include: { customer: { select: { id: true, companyName: true } } },
    });
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateWorkCardTemplateDto)
   * @returns Aktualisierter Datensatz
   */
  async update(id: string, dto: UpdateWorkCardTemplateDto) {
    await this.findOne(id);
    return this.prisma.workCardTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId || null } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields as any } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
      include: { customer: { select: { id: true, companyName: true } } },
    });
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.workCardTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}
