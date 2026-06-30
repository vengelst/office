import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import {
  DocumentEntityType,
  UploadDocumentDto,
} from './dto/upload-document.dto';
import { LinkDocumentDto } from './dto/link-document.dto';

/** Maximale Dateigröße: 10 MB. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Erlaubte MIME-Type-Präfixe/Werte. */
const ALLOWED_MIME_PATTERNS: RegExp[] = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
];

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PATTERNS.some((re) => re.test(mime));
}

/** Öffentliche Dokumentdarstellung inkl. Uploader-Name und Verknüpfungen. */
const documentSelect = {
  id: true,
  originalFilename: true,
  mimeType: true,
  fileSize: true,
  documentType: true,
  title: true,
  description: true,
  createdAt: true,
  uploadedBy: { select: { id: true, displayName: true } },
  links: { select: { id: true, entityType: true, entityId: true } },
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Datei in den Storage hochladen, Metadaten persistieren, optional verknüpfen. */
  async upload(
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    userId: string | null,
  ) {
    if (!file) {
      throw new BadRequestException('Keine Datei übermittelt');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Datei überschreitet 10 MB');
    }
    if (!isAllowedMime(file.mimetype)) {
      throw new BadRequestException(`Dateityp nicht erlaubt: ${file.mimetype}`);
    }

    const entityType = dto.entityType ?? 'general';
    const entityId = dto.entityId ?? 'unsorted';
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const storageKey = `${entityType}/${entityId}/${Date.now()}_${safeName}`;

    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    return this.prisma.document.create({
      data: {
        storageKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        documentType: dto.documentType,
        title: dto.title,
        description: dto.description,
        uploadedByUserId: userId,
        links:
          dto.entityType && dto.entityId
            ? {
                create: {
                  entityType: dto.entityType,
                  entityId: dto.entityId,
                },
              }
            : undefined,
      },
      select: documentSelect,
    });
  }

  /** Verknüpft ein bestehendes Dokument mit einer Entität (idempotent). */
  async link(documentId: string, dto: LinkDocumentDto) {
    await this.ensureExists(documentId);

    const existing = await this.prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    });
    if (!existing) {
      await this.prisma.documentLink.create({
        data: {
          documentId,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      });
    }
    return this.findOne(documentId);
  }

  /** Listet Dokumente einer Entität (über DocumentLink). */
  findByEntity(entityType: DocumentEntityType, entityId: string) {
    return this.prisma.document.findMany({
      where: { links: { some: { entityType, entityId } } },
      select: documentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: documentSelect,
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    return doc;
  }

  /** Liefert Stream + Metadaten für den Download. */
  async getDownload(
    id: string,
  ): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { storageKey: true, originalFilename: true, mimeType: true },
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    const stream = await this.storage.getStream(doc.storageKey);
    return {
      stream,
      filename: doc.originalFilename,
      mimeType: doc.mimeType,
    };
  }

  /** Löscht Dokument aus Storage und DB. */
  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, storageKey: true },
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    await this.storage.remove(doc.storageKey).catch(() => undefined);
    await this.prisma.document.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.document.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
  }
}
