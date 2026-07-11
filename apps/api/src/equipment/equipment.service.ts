import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentCondition, EquipmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';
import { ReturnEquipmentDto } from './dto/return-equipment.dto';
import type { Readable } from 'stream';

const WORKER_SELECT = {
  id: true,
  workerNumber: true,
  firstName: true,
  lastName: true,
  photoPath: true,
} satisfies Prisma.WorkerSelect;

export interface ListEquipmentParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
}

/**
 * Service für das Werkzeug- & Gerätemanagement.
 * CRUD mit Soft-Delete, Bild-Upload, Ausgabe an Monteure und Rückgabe.
 */
@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Paginierte, filterbare Geräteliste.
   * Inkludiert die aktuelle Zuweisung (Worker-Name).
   */
  async findAll(params: ListEquipmentParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.EquipmentWhereInput = { deletedAt: null };

    if (params.status) {
      where.status = params.status as EquipmentStatus;
    }
    if (params.category) {
      where.category = params.category;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { inventoryNumber: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          assignments: {
            where: { returnedAt: null },
            include: { worker: { select: WORKER_SELECT } },
            take: 1,
          },
        },
      }),
      this.prisma.equipment.count({ where }),
    ]);

    const data = rows.map((e) => {
      const { assignments, ...rest } = e;
      return { ...rest, currentAssignment: assignments[0] ?? null };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  /** Einzelnes Gerät mit vollständiger Zuweisungshistorie. */
  async findOne(id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: {
          include: { worker: { select: WORKER_SELECT } },
          orderBy: [{ returnedAt: 'asc' }, { assignedAt: 'desc' }],
        },
      },
    });
    if (!equipment) throw new NotFoundException('Gerät nicht gefunden');

    const { assignments, ...rest } = equipment;
    const currentAssignment = assignments.find((a) => a.returnedAt === null) ?? null;
    const history = assignments.filter((a) => a.returnedAt !== null);

    return { ...rest, assignments, currentAssignment, history };
  }

  /** Neues Gerät anlegen. */
  async create(dto: CreateEquipmentDto) {
    return this.prisma.equipment.create({
      data: {
        name: dto.name,
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        manufacturer: dto.manufacturer?.trim() || null,
        model: dto.model?.trim() || null,
        serialNumber: dto.serialNumber?.trim() || null,
        inventoryNumber: dto.inventoryNumber?.trim() || null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchasePrice: dto.purchasePrice ?? null,
        status: (dto.status as EquipmentStatus) ?? undefined,
        condition: (dto.condition as EquipmentCondition) ?? undefined,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  /** Gerät aktualisieren. */
  async update(id: string, dto: UpdateEquipmentDto) {
    await this.ensureExists(id);
    const data: Prisma.EquipmentUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.category !== undefined) data.category = dto.category?.trim() || null;
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer?.trim() || null;
    if (dto.model !== undefined) data.model = dto.model?.trim() || null;
    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber?.trim() || null;
    if (dto.inventoryNumber !== undefined) data.inventoryNumber = dto.inventoryNumber?.trim() || null;
    if (dto.purchaseDate !== undefined) data.purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate) : null;
    if (dto.purchasePrice !== undefined) data.purchasePrice = dto.purchasePrice ?? null;
    if (dto.status !== undefined) data.status = dto.status as EquipmentStatus;
    if (dto.condition !== undefined) data.condition = dto.condition as EquipmentCondition;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    return this.prisma.equipment.update({ where: { id }, data });
  }

  /** Soft-Delete: setzt deletedAt. */
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }

  /** Bild hochladen und in MinIO speichern. */
  async uploadImage(id: string, file: Express.Multer.File) {
    await this.ensureExists(id);

    if (!file) throw new BadRequestException('Keine Datei hochgeladen');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const storageKey = `equipment/${id}/image.${ext}`;

    const existing = await this.prisma.equipment.findUnique({
      where: { id },
      select: { imageKey: true },
    });
    if (existing?.imageKey && existing.imageKey !== storageKey) {
      await this.storage.remove(existing.imageKey).catch(() => undefined);
    }

    await this.storage.upload(storageKey, file.buffer, file.mimetype);
    await this.prisma.equipment.update({
      where: { id },
      data: { imageKey: storageKey },
    });

    return { id, imageKey: storageKey };
  }

  /** Liefert das Gerätebild als Stream. */
  async getImage(id: string): Promise<{ stream: Readable; mimeType: string }> {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      select: { imageKey: true },
    });
    if (!equipment?.imageKey) {
      throw new NotFoundException('Kein Bild vorhanden');
    }
    const mimeType = equipment.imageKey.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
    const stream = await this.storage.getStream(equipment.imageKey);
    return { stream, mimeType };
  }

  /**
   * Gerät an einen Monteur ausgeben.
   * Setzt den Status auf ASSIGNED.
   */
  async assign(id: string, dto: AssignEquipmentDto, assignedBy?: string) {
    await this.ensureExists(id);

    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.workerId, deletedAt: null },
      select: { id: true },
    });
    if (!worker) throw new BadRequestException('Monteur nicht gefunden');

    const openAssignment = await this.prisma.equipmentAssignment.findFirst({
      where: { equipmentId: id, returnedAt: null },
    });
    if (openAssignment) {
      throw new BadRequestException(
        'Gerät ist bereits ausgegeben. Bitte zuerst Rückgabe durchführen.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.equipmentAssignment.create({
        data: {
          equipmentId: id,
          workerId: dto.workerId,
          expectedReturn: dto.expectedReturn
            ? new Date(dto.expectedReturn)
            : null,
          notes: dto.notes?.trim() || null,
          assignedBy: assignedBy ?? null,
        },
      }),
      this.prisma.equipment.update({
        where: { id },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    return this.findOne(id);
  }

  /**
   * Rückgabe registrieren.
   * Setzt returnedAt und den Equipment-Status auf AVAILABLE.
   */
  async returnEquipment(id: string, dto: ReturnEquipmentDto) {
    await this.ensureExists(id);

    const open = await this.prisma.equipmentAssignment.findFirst({
      where: { equipmentId: id, returnedAt: null },
    });
    if (!open) {
      throw new BadRequestException('Keine offene Ausgabe vorhanden');
    }

    await this.prisma.$transaction([
      this.prisma.equipmentAssignment.update({
        where: { id: open.id },
        data: {
          returnedAt: new Date(),
          returnNotes: dto.returnNotes?.trim() || null,
          returnCondition: dto.returnCondition
            ? (dto.returnCondition as EquipmentCondition)
            : null,
        },
      }),
      this.prisma.equipment.update({
        where: { id },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    return this.findOne(id);
  }

  /** Alle Zuweisungen eines Geräts. */
  async getAssignmentHistory(equipmentId: string) {
    return this.prisma.equipmentAssignment.findMany({
      where: { equipmentId },
      include: { worker: { select: WORKER_SELECT } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  /** Aktuelle Geräte eines Monteurs (nicht zurückgegeben). */
  async getWorkerEquipment(workerId: string) {
    return this.prisma.equipmentAssignment.findMany({
      where: { workerId, returnedAt: null },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            category: true,
            inventoryNumber: true,
            imageKey: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  /** Aktive Monteure für Auswahl-Dropdown. */
  listWorkers() {
    return this.prisma.worker.findMany({
      where: { active: true, deletedAt: null },
      select: WORKER_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  /** Alle vorhandenen Kategorien (Distinct). */
  async listCategories(): Promise<string[]> {
    const result = await this.prisma.equipment.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return result.map((r) => r.category!).filter(Boolean);
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.equipment.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) throw new NotFoundException('Gerät nicht gefunden');
  }
}
