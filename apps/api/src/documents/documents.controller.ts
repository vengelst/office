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

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

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

  @Post(':id/link')
  @ApiOperation({ summary: 'Dokument mit einer Entität verknüpfen' })
  link(@Param('id') id: string, @Body() dto: LinkDocumentDto) {
    return this.documents.link(id, dto);
  }

  @Get('types-for-context')
  @ApiOperation({ summary: 'Kontextbezogene Dokumenttypen je Entitätstyp' })
  typesForContext(@Query('entityType') entityType: string) {
    return this.documents.typesForContext(entityType);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Dokumente mit Ablauf in den nächsten 30 Tagen' })
  expiring() {
    return this.documents.expiring();
  }

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

  @Get(':id')
  @ApiOperation({ summary: 'Dokument-Detail inkl. Versions-Historie' })
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

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

  @Delete(':id')
  @ApiOperation({ summary: 'Dokument löschen (Storage + DB)' })
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
