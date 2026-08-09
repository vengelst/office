/**
 * Service für Document Folders.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

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

  /**
   * Listet die Ordner einer Entität (sortiert).
   *
   * @param entityType - Entitätstyp (Customer, Project, …) (string)
   * @param entityId - ID der verknüpften Entität (string)
   * @returns Ordnerliste
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  findForEntity(entityType: string, entityId: string) {
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType und entityId erforderlich');
    }
    return this.prisma.documentFolder.findMany({
      where: { entityType, entityId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Erstellt einen neuen Ordner.
   *
   * @param dto - Request-Body / Eingabedaten (CreateDocumentFolderDto)
   * @returns Neu angelegter Datensatz
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
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

  /**
   * Benennt einen Ordner um / setzt Sortierung.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateDocumentFolderDto)
   * @returns Aktualisierter Datensatz
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
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

  /**
   * Löscht einen Ordner – nur wenn er keine Dokumente und keine Unterordner enthält.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
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

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureExists` (ensure Exists).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.documentFolder.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Ordner nicht gefunden');
    }
  }
}
