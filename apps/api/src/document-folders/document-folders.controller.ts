/**
 * HTTP-API für Document Folders.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentFoldersService } from './document-folders.service';
import { CreateDocumentFolderDto } from './dto/create-document-folder.dto';
import { UpdateDocumentFolderDto } from './dto/update-document-folder.dto';

@ApiTags('document-folders')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('document-folders')
export class DocumentFoldersController {
  constructor(private readonly folders: DocumentFoldersService) {}

  /**
   * Listet Ordner einer Entität (Kunde/Projekt/…).
   *
   * @param entityType - Entitätstyp (Customer, Project, …) (string)
   * @param entityId - ID der verknüpften Entität (string)
   * @returns Ordnerliste
   */

  @Get()
  @ApiOperation({ summary: 'Ordner einer Entität auflisten' })
  findForEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.folders.findForEntity(entityType, entityId);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateDocumentFolderDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Ordner erstellen' })
  create(@Body() dto: CreateDocumentFolderDto) {
    return this.folders.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateDocumentFolderDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Ordner umbenennen / sortieren' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentFolderDto) {
    return this.folders.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Ordner löschen (nur wenn leer)' })
  remove(@Param('id') id: string) {
    return this.folders.remove(id);
  }
}
