import {
  BadRequestException,
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService, MAX_FILE_SIZE } from './documents.service';
import {
  DOCUMENT_ENTITY_TYPES,
  DocumentEntityType,
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

  @Post(':id/link')
  @ApiOperation({ summary: 'Dokument mit einer Entität verknüpfen' })
  link(@Param('id') id: string, @Body() dto: LinkDocumentDto) {
    return this.documents.link(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Dokumente einer Entität auflisten' })
  findByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    if (
      !entityType ||
      !entityId ||
      !DOCUMENT_ENTITY_TYPES.includes(entityType as DocumentEntityType)
    ) {
      throw new BadRequestException('entityType und entityId erforderlich');
    }
    return this.documents.findByEntity(
      entityType as DocumentEntityType,
      entityId,
    );
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

  @Delete(':id')
  @ApiOperation({ summary: 'Dokument löschen (Storage + DB)' })
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }
}
