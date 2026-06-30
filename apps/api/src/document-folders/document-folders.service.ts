import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentFolderDto } from './dto/create-document-folder.dto';
import { UpdateDocumentFolderDto } from './dto/update-document-folder.dto';

@Injectable()
export class DocumentFoldersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listet die Ordner einer Entität (sortiert). */
  findForEntity(entityType: string, entityId: string) {
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType und entityId erforderlich');
    }
    return this.prisma.documentFolder.findMany({
      where: { entityType, entityId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Erstellt einen neuen Ordner. */
  create(dto: CreateDocumentFolderDto) {
    return this.prisma.documentFolder.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        name: dto.name,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** Benennt einen Ordner um / setzt Sortierung. */
  async update(id: string, dto: UpdateDocumentFolderDto) {
    await this.ensureExists(id);
    return this.prisma.documentFolder.update({
      where: { id },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
      },
    });
  }

  /** Löscht einen Ordner – nur wenn er keine Dokumente und keine Unterordner enthält. */
  async remove(id: string) {
    const folder = await this.prisma.documentFolder.findUnique({
      where: { id },
      include: {
        _count: { select: { links: true, children: true } },
      },
    });
    if (!folder) {
      throw new NotFoundException('Ordner nicht gefunden');
    }
    if (folder._count.links > 0 || folder._count.children > 0) {
      throw new BadRequestException(
        'Ordner ist nicht leer und kann nicht gelöscht werden',
      );
    }
    await this.prisma.documentFolder.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.documentFolder.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Ordner nicht gefunden');
    }
  }
}
