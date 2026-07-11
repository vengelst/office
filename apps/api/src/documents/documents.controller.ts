import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentType, RoleCode } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService, MAX_FILE_SIZE } from './documents.service';
import {
  ReplaceDocumentDto,
  UploadDocumentDto,
} from './dto/upload-document.dto';
import { LinkDocumentDto } from './dto/link-document.dto';

/**
 * Controller für das Dokumentenmanagement (DMS).
 * Verwaltet Upload, Download, Versionierung und Verknüpfung
 * von Dateien mit Entitäten (Kunden, Projekte, Monteure, etc.).
 */
@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Lädt eine einzelne Datei mit Metadaten hoch und speichert sie im Storage.
   * POST /api/documents/upload
   *
   * @param file - Die hochgeladene Datei (Multipart)
   * @param dto - Metadaten (Dokumenttyp, Entitätsverknüpfung, Titel)
   * @param user - Aktuell authentifizierter Benutzer
   * @returns Das erstellte Dokument mit Storage-Informationen
   */
  @Post('upload')
  @ApiOperation({ summary: 'Datei hochladen (Multipart) + Metadaten' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.upload(
      file,
      dto,
      user.type === 'user' ? user.id : null,
    );
  }

  /**
   * Lädt bis zu 10 Dateien gleichzeitig hoch (gleicher Entitäts-Kontext).
   * POST /api/documents/upload-multiple
   *
   * @param files - Array der hochgeladenen Dateien (max. 10)
   * @param dto - Gemeinsame Metadaten für alle Dateien
   * @param user - Aktuell authentifizierter Benutzer
   * @returns Array der erstellten Dokumente
   */
  @Post('upload-multiple')
  @ApiOperation({ summary: 'Mehrere Dateien hochladen (gleicher Kontext)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.uploadMultiple(
      files,
      dto,
      user.type === 'user' ? user.id : null,
    );
  }

  /**
   * Ersetzt ein bestehendes Dokument durch eine neue Version.
   * Die alte Version wird in der Versions-Historie aufbewahrt.
   * POST /api/documents/:id/replace
   *
   * @param id - UUID des bestehenden Dokuments
   * @param file - Die neue Datei
   * @param dto - Optionale aktualisierte Metadaten
   * @param user - Aktuell authentifizierter Benutzer
   * @returns Das aktualisierte Dokument
   */
  @Post(':id/replace')
  @ApiOperation({ summary: 'Dokument durch neue Version ersetzen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  replace(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ReplaceDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.replace(
      id,
      file,
      dto,
      user.type === 'user' ? user.id : null,
    );
  }

  /**
   * Verknüpft ein Dokument zusätzlich mit einer weiteren Entität.
   * POST /api/documents/:id/link
   *
   * @param id - UUID des Dokuments
   * @param dto - Entitätstyp und -ID für die Verknüpfung
   * @returns Das aktualisierte Dokument mit allen Verknüpfungen
   */
  @Post(':id/link')
  @ApiOperation({ summary: 'Dokument mit einer Entität verknüpfen' })
  link(@Param('id') id: string, @Body() dto: LinkDocumentDto) {
    return this.documents.link(id, dto);
  }

  /**
   * Gibt die erlaubten Dokumenttypen für einen bestimmten Entitätstyp zurück.
   * GET /api/documents/types-for-context
   *
   * @param entityType - Entitätstyp (z.B. PROJECT, CUSTOMER, WORKER)
   * @returns Array der verfügbaren Dokumenttypen
   */
  @Get('types-for-context')
  @ApiOperation({ summary: 'Kontextbezogene Dokumenttypen je Entitätstyp' })
  typesForContext(@Query('entityType') entityType: string) {
    return this.documents.typesForContext(entityType);
  }

  /**
   * Liefert Dokumente, deren Gültigkeitsdatum in den nächsten 30 Tagen abläuft.
   * GET /api/documents/expiring
   *
   * @returns Array ablaufender Dokumente
   */
  @Get('expiring')
  @ApiOperation({ summary: 'Dokumente mit Ablauf in den nächsten 30 Tagen' })
  expiring() {
    return this.documents.expiring();
  }

  /**
   * Listet Dokumente auf, gefiltert nach Entität, Ordner, Typ oder Suchbegriff.
   * GET /api/documents
   *
   * @param entityType - Optional: Entitätstyp-Filter
   * @param entityId - Optional: Entitäts-ID-Filter
   * @param folderId - Optional: Ordner-Filter
   * @param documentType - Optional: Dokumenttyp-Filter
   * @param search - Optional: Freitextsuche
   * @returns Array gefilterter Dokumente
   */
  @Get()
  @ApiOperation({ summary: 'Dokumente auflisten/suchen (Filter)' })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('folderId') folderId?: string,
    @Query('documentType') documentType?: DocumentType,
    @Query('search') search?: string,
  ) {
    return this.documents.findAll({
      entityType,
      entityId,
      folderId,
      documentType,
      search,
    });
  }

  /**
   * Liefert Detailinformationen eines Dokuments inkl. Versions-Historie.
   * GET /api/documents/:id
   *
   * @param id - UUID des Dokuments
   * @returns Dokument mit Metadaten und Versionen
   */
  @Get(':id')
  @ApiOperation({ summary: 'Dokument-Detail inkl. Versions-Historie' })
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  /**
   * Streamt die Datei zum Client als Download.
   * GET /api/documents/:id/download
   *
   * @param id - UUID des Dokuments
   * @param res - Express Response (für Header)
   * @returns StreamableFile mit korrekten Content-Type und Disposition Headern
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Datei herunterladen (Stream)' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename, mimeType } =
      await this.documents.getDownload(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        filename,
      )}"`,
    });
    return new StreamableFile(stream);
  }

  /**
   * Streamt das Thumbnail eines Bild-Dokuments.
   * GET /api/documents/:id/thumbnail
   *
   * @param id - UUID des Dokuments
   * @param res - Express Response (für Header)
   * @returns StreamableFile des Thumbnails
   */
  @Get(':id/thumbnail')
  @ApiOperation({ summary: 'Thumbnail eines Bild-Dokuments (Stream)' })
  async thumbnail(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.documents.getThumbnail(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }

  /**
   * Löscht ein Dokument vollständig aus Storage und Datenbank.
   * DELETE /api/documents/:id
   *
   * @param id - UUID des Dokuments
   * @returns Bestätigung der Löschung
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Dokument löschen (Storage + DB)' })
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
