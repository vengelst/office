import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { StoragePathService } from '../common/storage-path.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import {
  DocumentEntityType,
  ReplaceDocumentDto,
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

/** MIME-Types für die ein Thumbnail erzeugt wird. */
const THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PATTERNS.some((re) => re.test(mime));
}

/**
 * Kontextbezogene Dokumenttypen je Entitätstyp.
 * Steuert, welche DocumentTypes beim Upload je Kontext angeboten werden.
 */
const TYPES_FOR_CONTEXT: Record<string, DocumentType[]> = {
  WORKER: [
    DocumentType.PASSPORT,
    DocumentType.ID_CARD,
    DocumentType.WORK_PERMIT,
    DocumentType.RESIDENCE_PERMIT,
    DocumentType.CERTIFICATION,
    DocumentType.HEALTH_CERTIFICATE,
    DocumentType.WORKER_PHOTO,
    DocumentType.CONTRACT,
    DocumentType.OTHER,
  ],
  CUSTOMER: [
    DocumentType.CONTRACT,
    DocumentType.BUSINESS_CARD,
    DocumentType.LOGO,
    DocumentType.INVOICE,
    DocumentType.CERTIFICATE,
    DocumentType.NOTE_DOCUMENT,
    DocumentType.OTHER,
  ],
  PROJECT: [
    DocumentType.PHOTO,
    DocumentType.SITE_PHOTO,
    DocumentType.DELIVERY_NOTE,
    DocumentType.INVOICE,
    DocumentType.PROJECT_DOC,
    DocumentType.DRAWING,
    DocumentType.WORK_CONTRACT,
    DocumentType.SPECIFICATION,
    DocumentType.HANDOVER_PROTOCOL,
    DocumentType.OTHER,
  ],
  VEHICLE: [
    DocumentType.REGISTRATION_DOC,
    DocumentType.INSURANCE_DOC,
    DocumentType.INSPECTION_DOC,
    DocumentType.PHOTO,
    DocumentType.OTHER,
  ],
};

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
  storagePath: true,
  thumbnailKey: true,
  version: true,
  replacesId: true,
  isLatest: true,
  expiryDate: true,
  tags: true,
  uploadSource: true,
  driveFileId: true,
  driveFolderId: true,
  uploadedBy: { select: { id: true, displayName: true } },
  links: {
    select: { id: true, entityType: true, entityId: true, folderId: true },
  },
} satisfies Prisma.DocumentSelect;

/**
 * Service für das Dokumentenmanagement (DMS).
 * Verwaltet Upload, Versionierung, Verknüpfung und Download von Dokumenten.
 * Synchronisiert Dateien automatisch nach Google Drive und erzeugt Thumbnails für Bilder.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly storagePath: StoragePathService,
    private readonly driveService: GoogleDriveService,
  ) {}

  /**
   * Lädt eine Datei in den MinIO-Storage hoch und persistiert die Metadaten in der DB.
   * Erzeugt automatisch einen lesbaren Speicherpfad, ein Thumbnail (bei Bildern)
   * und startet die asynchrone Google-Drive-Synchronisation.
   *
   * @param file - Die hochgeladene Datei (Multer)
   * @param dto - Upload-Metadaten (Dokumenttyp, Entität, Titel, Tags, etc.)
   * @param userId - ID des hochladenden Benutzers (oder null bei System-Uploads)
   * @returns Das erstellte Dokument mit allen Relationen
   * @throws BadRequestException bei fehlender Datei, Größenüberschreitung oder ungültigem MIME-Type
   */
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

    // Lesbaren Pfad generieren, wenn Entity-Kontext vorhanden.
    let storagePath: string;
    if (dto.storagePath) {
      storagePath = dto.storagePath;
    } else if (entityType !== 'general' && entityId !== 'unsorted') {
      storagePath = await this.storagePath.generatePath(
        entityType,
        entityId,
        dto.documentType,
        safeName,
      );
    } else {
      storagePath = `${entityType}/${entityId}/${safeName}`;
    }

    // MinIO-Key = lesbarer Pfad mit Prefix und Timestamp zur Eindeutigkeit.
    const storageKey = `documents/${storagePath.replace(/\/([^/]+)$/, `/${Date.now()}_$1`)}`;

    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const thumbnailKey = await this.maybeCreateThumbnail(
      storageKey,
      file.buffer,
      file.mimetype,
    );

    const doc = await this.prisma.document.create({
      data: {
        storageKey,
        storagePath,
        thumbnailKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        documentType: dto.documentType,
        title: dto.title,
        description: dto.description,
        tags: dto.tags,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        uploadSource: dto.uploadSource,
        uploadedByUserId: userId,
        links:
          dto.entityType && dto.entityId
            ? {
                create: {
                  entityType: dto.entityType,
                  entityId: dto.entityId,
                  folderId: dto.folderId,
                },
              }
            : undefined,
      },
      select: documentSelect,
    });

    // Google Drive Sync (async, non-blocking).
    if (entityType !== 'general' && entityId !== 'unsorted') {
      this.syncToDrive(doc.id, file.buffer, file.mimetype, entityType, entityId, dto.documentType, safeName)
        .catch((err) => this.logger.warn(`Drive-Sync übersprungen: ${(err as Error).message}`));
    }

    return doc;
  }

  /**
   * Massen-Upload: lädt mehrere Dateien mit identischem Kontext (Entität, Dokumenttyp) hoch.
   * Jede Datei wird einzeln verarbeitet (Validierung, Thumbnail, Drive-Sync).
   *
   * @param files - Array der hochgeladenen Dateien
   * @param dto - Gemeinsame Upload-Metadaten für alle Dateien
   * @param userId - ID des hochladenden Benutzers
   * @returns Array der erstellten Dokumente
   * @throws BadRequestException wenn keine Dateien übermittelt wurden
   */
  async uploadMultiple(
    files: Express.Multer.File[] | undefined,
    dto: UploadDocumentDto,
    userId: string | null,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Keine Dateien übermittelt');
    }
    const created = [];
    for (const file of files) {
      created.push(await this.upload(file, dto, userId));
    }
    return created;
  }

  /**
   * Ersetzt ein Dokument durch eine neue Version (Versionierung).
   * Das alte Dokument wird auf isLatest=false gesetzt, die neue Version
   * übernimmt automatisch Verknüpfungen, Ordner, Typ und Titel des Originals.
   * Die Versionsnummer wird inkrementiert.
   *
   * @param id - UUID des zu ersetzenden Dokuments
   * @param file - Die neue Dateiversion (Multer)
   * @param dto - Optionale Metadaten (Tags, Ablaufdatum)
   * @param userId - ID des hochladenden Benutzers
   * @returns Das neue Dokument (aktuelle Version)
   * @throws NotFoundException wenn das Originaldokument nicht existiert
   */
  async replace(
    id: string,
    file: Express.Multer.File | undefined,
    dto: ReplaceDocumentDto,
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

    const old = await this.prisma.document.findUnique({
      where: { id },
      include: { links: true },
    });
    if (!old) {
      throw new NotFoundException('Dokument nicht gefunden');
    }

    const entityType = old.links[0]?.entityType ?? 'general';
    const entityId = old.links[0]?.entityId ?? 'unsorted';
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const storageKey = `documents/${entityType}/${entityId}/${Date.now()}_${safeName}`;
    const storagePath =
      old.storagePath ?? `${entityType}/${entityId}/${safeName}`;

    await this.storage.upload(storageKey, file.buffer, file.mimetype);
    const thumbnailKey = await this.maybeCreateThumbnail(
      storageKey,
      file.buffer,
      file.mimetype,
    );

    const [, fresh] = await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id },
        data: { isLatest: false },
      }),
      this.prisma.document.create({
        data: {
          storageKey,
          storagePath,
          thumbnailKey,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          documentType: old.documentType,
          title: old.title,
          description: old.description,
          tags: dto.tags ?? old.tags,
          expiryDate: dto.expiryDate
            ? new Date(dto.expiryDate)
            : (old.expiryDate ?? undefined),
          uploadSource: dto.uploadSource,
          uploadedByUserId: userId,
          version: old.version + 1,
          replacesId: old.id,
          isLatest: true,
          links: {
            create: old.links.map((l) => ({
              entityType: l.entityType,
              entityId: l.entityId,
              folderId: l.folderId,
            })),
          },
        },
        select: documentSelect,
      }),
    ]);

    return fresh;
  }

  /**
   * Verknüpft ein bestehendes Dokument mit einer Entität (idempotent).
   * Ermöglicht die Zuordnung eines Dokuments zu mehreren Entitäten gleichzeitig.
   *
   * @param documentId - UUID des Dokuments
   * @param dto - Verknüpfungsdaten (Entitätstyp + ID)
   * @returns Das verknüpfte Dokument mit allen Links
   */
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

  /**
   * Listet Dokumente mit optionalen Filtern (Entität, Ordner, Typ, Volltextsuche).
   * Zeigt nur die jeweils aktuelle Version (isLatest=true).
   * Ohne Filter werden alle aktuellen Dokumente zurückgegeben (globale Suche).
   *
   * @param filters - Optionale Filter (entityType, entityId, folderId, documentType, search)
   * @returns Liste der passenden Dokumente, neueste zuerst
   */
  findAll(filters: {
    entityType?: string;
    entityId?: string;
    folderId?: string;
    documentType?: DocumentType;
    search?: string;
  }) {
    const where: Prisma.DocumentWhereInput = { isLatest: true };

    if (filters.entityType || filters.entityId || filters.folderId) {
      where.links = {
        some: {
          ...(filters.entityType ? { entityType: filters.entityType } : {}),
          ...(filters.entityId ? { entityId: filters.entityId } : {}),
          ...(filters.folderId ? { folderId: filters.folderId } : {}),
        },
      };
    }

    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    if (filters.search) {
      const q = filters.search;
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { originalFilename: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.document.findMany({
      where,
      select: documentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Listet alle Dokumente einer bestimmten Entität (Kunde, Projekt, Monteur, etc.).
   *
   * @param entityType - Typ der Entität (CUSTOMER, PROJECT, WORKER, etc.)
   * @param entityId - UUID der Entität
   * @returns Liste der verknüpften Dokumente
   */
  findByEntity(entityType: DocumentEntityType, entityId: string) {
    return this.findAll({ entityType, entityId });
  }

  /**
   * Liefert ein einzelnes Dokument inkl. Versions-Historie (vorherige und nachfolgende Versionen).
   *
   * @param id - Dokument-UUID
   * @returns Das Dokument mit Versionsverlauf
   * @throws NotFoundException wenn das Dokument nicht existiert
   */
  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        ...documentSelect,
        replacedBy: { select: documentSelect },
        previousVersions: {
          select: documentSelect,
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    return doc;
  }

  /**
   * Liefert Dokumente, deren Ablaufdatum in den nächsten 30 Tagen liegt.
   * Nützlich für Frühwarnsysteme bei auslaufenden Verträgen, Zertifikaten, etc.
   *
   * @returns Liste ablaufender Dokumente, sortiert nach Ablaufdatum
   */
  expiring() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return this.prisma.document.findMany({
      where: {
        isLatest: true,
        expiryDate: { gte: now, lte: in30Days },
      },
      select: documentSelect,
      orderBy: { expiryDate: 'asc' },
    });
  }

  /**
   * Gibt die erlaubten Dokumenttypen für einen Entitätstyp zurück.
   * Steuert die Dropdown-Auswahl im Frontend je nach Kontext (Kunde, Projekt, etc.).
   *
   * @param entityType - Typ der Entität (CUSTOMER, PROJECT, WORKER, VEHICLE)
   * @returns Array der verfügbaren DocumentTypes für diesen Kontext
   */
  typesForContext(entityType: string): DocumentType[] {
    return TYPES_FOR_CONTEXT[entityType] ?? Object.values(DocumentType);
  }

  /**
   * Liefert einen ReadableStream und Metadaten für den Datei-Download aus MinIO.
   *
   * @param id - Dokument-UUID
   * @returns Objekt mit Stream, Dateiname und MIME-Type
   * @throws NotFoundException wenn das Dokument nicht existiert
   */
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

  /**
   * Liefert den Thumbnail-Stream eines Bild-Dokuments (300x300 JPEG).
   *
   * @param id - Dokument-UUID
   * @returns Stream und MIME-Type des Thumbnails
   * @throws NotFoundException wenn Dokument oder Thumbnail nicht existiert
   */
  async getThumbnail(id: string): Promise<{ stream: Readable; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { thumbnailKey: true },
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    if (!doc.thumbnailKey) {
      throw new NotFoundException('Kein Thumbnail vorhanden');
    }
    const stream = await this.storage.getStream(doc.thumbnailKey);
    return { stream, mimeType: 'image/jpeg' };
  }

  /**
   * Löscht ein Dokument vollständig: entfernt Datei und Thumbnail aus MinIO sowie den DB-Eintrag.
   *
   * @param id - Dokument-UUID
   * @returns Bestätigung mit gelöschter ID
   * @throws NotFoundException wenn das Dokument nicht existiert
   */
  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, storageKey: true, thumbnailKey: true },
    });
    if (!doc) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
    await this.storage.remove(doc.storageKey).catch(() => undefined);
    if (doc.thumbnailKey) {
      await this.storage.remove(doc.thumbnailKey).catch(() => undefined);
    }
    await this.prisma.document.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Erzeugt – falls möglich – ein 300x300-Thumbnail (Cover-Fit) für Bilder.
   * Nutzt `sharp` falls verfügbar; bei fehlender Bibliothek oder Fehler
   * wird ohne Thumbnail fortgefahren (Fallback: null).
   */
  private async maybeCreateThumbnail(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string | null> {
    if (!THUMBNAIL_MIME_TYPES.has(mimeType)) {
      return null;
    }
    try {
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default ?? sharpModule;
      const thumb = await sharp(buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      const thumbnailKey = `${storageKey}.thumb.jpg`;
      await this.storage.upload(thumbnailKey, thumb, 'image/jpeg');
      return thumbnailKey;
    } catch (err) {
      this.logger.warn(
        `Thumbnail-Erzeugung übersprungen: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Erstellt ein Dokument direkt aus einem Buffer (für automatische PDF-Exports, z.B. Stundenzettel).
   * Speichert in MinIO mit lesbarem Pfad und synchronisiert asynchron nach Google Drive.
   * Unterstützt mehrere Entitäts-Verknüpfungen in einem Aufruf.
   *
   * @param params - Dokument-Parameter (Buffer, Dateiname, MIME-Type, Entitätskontext, etc.)
   * @returns Das erstellte Dokument mit Verknüpfungen
   */
  async createFromBuffer(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    documentType: DocumentType;
    entityType: string;
    entityId: string;
    storagePath: string;
    title?: string;
    userId?: string | null;
    additionalLinks?: Array<{ entityType: string; entityId: string }>;
  }) {
    const storageKey = `documents/${params.storagePath}`;
    await this.storage.upload(storageKey, params.buffer, params.mimeType);

    const links = [
      { entityType: params.entityType, entityId: params.entityId },
      ...(params.additionalLinks ?? []),
    ];

    const doc = await this.prisma.document.create({
      data: {
        storageKey,
        storagePath: params.storagePath,
        originalFilename: params.filename,
        mimeType: params.mimeType,
        fileSize: params.buffer.length,
        documentType: params.documentType,
        title: params.title ?? params.filename,
        uploadedByUserId: params.userId ?? null,
        uploadSource: 'system',
        links: { create: links },
      },
      select: documentSelect,
    });

    // Drive-Sync (async, non-blocking).
    this.syncToDrive(
      doc.id,
      params.buffer,
      params.mimeType,
      params.entityType,
      params.entityId,
      params.documentType,
      params.filename,
    ).catch((err) => this.logger.warn(`Drive-Sync übersprungen: ${(err as Error).message}`));

    return doc;
  }

  /**
   * Synchronisiert ein Dokument asynchron nach Google Drive.
   * Erstellt die nötige Ordnerstruktur (Kategorie → Entität → Unterordner) und
   * speichert driveFileId + driveFolderId am Document-Eintrag für spätere Referenz.
   *
   * @param documentId - DB-UUID des Dokuments
   * @param buffer - Dateiinhalt
   * @param mimeType - MIME-Type der Datei
   * @param entityType - Entitätstyp (CUSTOMER, PROJECT, etc.)
   * @param entityId - UUID der Entität
   * @param documentType - Dokumentkategorie (CONTRACT, INVOICE, etc.)
   * @param filename - Lesbarer Dateiname
   */
  private async syncToDrive(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    entityType: string,
    entityId: string,
    documentType: string,
    filename: string,
  ): Promise<void> {
    const enabled = await this.driveService.isEnabled();
    if (!enabled) return;

    const info = await this.storagePath.getEntityInfo(entityType, entityId);
    const categoryName = this.storagePath.driveCategoryName(entityType);
    const entityFolderName = this.storagePath.driveEntityFolderName(entityType, info);
    const subFolderName = this.storagePath.driveFolderName(documentType);

    const result = await this.driveService.uploadWithStructure(
      buffer,
      mimeType,
      categoryName,
      entityFolderName,
      subFolderName,
      filename,
    );

    if (result) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          driveFileId: result.fileId,
          driveFolderId: result.folderId,
        },
      });
    }
  }

  /**
   * Prüft ob ein Dokument existiert, wirft NotFoundException falls nicht.
   *
   * @param id - Dokument-UUID
   * @throws NotFoundException
   */
  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.document.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Dokument nicht gefunden');
    }
  }
}
