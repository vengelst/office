import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto, UpdateBlockDto } from './dto/block.dto';
import { WorkItemsService } from './work-items.service';

/**
 * Verwaltung der Blöcke eines Projekts (Gruppierung der Items, typisch 1 PDF pro Block).
 * Das Block-PDF selbst wird über das bestehende Dokumentenmodul hochgeladen und
 * hier nur per `pdfDocumentId` referenziert.
 */
@Injectable()
export class WorkItemBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
  ) {}

  /** Blöcke eines Projekts inkl. Item-Anzahl. */
  async findAll(projectId: string) {
    await this.workItems.ensureProject(projectId);
    return this.prisma.projectBlock.findMany({
      where: { projectId },
      orderBy: { blockKey: 'asc' },
      include: { _count: { select: { workItems: true } } },
    });
  }

  /**
   * Legt einen Block an.
   *
   * @throws ConflictException wenn der blockKey im Projekt bereits existiert
   */
  async create(projectId: string, dto: CreateBlockDto) {
    await this.workItems.ensureProject(projectId);
    const existing = await this.prisma.projectBlock.findUnique({
      where: { projectId_blockKey: { projectId, blockKey: dto.blockKey } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Block "${dto.blockKey}" existiert bereits`);
    }
    return this.prisma.projectBlock.create({
      data: { projectId, ...dto },
    });
  }

  /** Block bearbeiten (Name, Block-PDF). */
  async update(projectId: string, blockId: string, dto: UpdateBlockDto) {
    await this.ensureBlock(projectId, blockId);
    return this.prisma.projectBlock.update({
      where: { id: blockId },
      data: dto,
    });
  }

  /** Block löschen; zugeordnete Items verlieren nur die Block-Referenz. */
  async remove(projectId: string, blockId: string) {
    await this.ensureBlock(projectId, blockId);
    await this.prisma.projectBlock.delete({ where: { id: blockId } });
    return { id: blockId, deleted: true };
  }

  private async ensureBlock(projectId: string, blockId: string) {
    const block = await this.prisma.projectBlock.findFirst({
      where: { id: blockId, projectId },
      select: { id: true },
    });
    if (!block) {
      throw new NotFoundException('Block nicht gefunden');
    }
    return block;
  }
}
