/**
 * HTTP-API für Subcontractors.
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
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubcontractorsService } from './subcontractors.service';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { CreateSubcontractorContactDto } from './dto/create-subcontractor-contact.dto';
import { UpdateSubcontractorContactDto } from './dto/update-subcontractor-contact.dto';

@ApiTags('subcontractors')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('subcontractors')
export class SubcontractorsController {
  constructor(private readonly subcontractors: SubcontractorsService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param active - Parameter `active` (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Subunternehmen auflisten (Suche, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.subcontractors.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      active:
        active === undefined ? undefined : active === 'true' || active === '1',
      sortBy,
      sortDir,
    });
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Subunternehmen-Detail mit Monteuren und Kontakten' })
  findOne(@Param('id') id: string) {
    return this.subcontractors.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateSubcontractorDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Subunternehmen anlegen' })
  create(@Body() dto: CreateSubcontractorDto) {
    return this.subcontractors.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSubcontractorDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Subunternehmen bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateSubcontractorDto) {
    return this.subcontractors.update(id, dto);
  }


  /**
   * Löscht bzw. deaktiviert mehrere Datensätze in einem Schritt.
   *
   * @param dto - Request-Body / Eingabedaten (BulkDeleteDto)
   * @returns Ergebnis der Massenlöschung
   */

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Mehrfach löschen' })
  bulkRemove(@Body() dto: BulkDeleteDto) {
    return this.subcontractors.bulkRemove(dto.ids);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Subunternehmen löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.subcontractors.remove(id);
  }

  // ── Kontakte ─────────────────────────────────────────────────

  /**
   * Listet Kontakte der Entität.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Kontakt-Liste
   */

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Kontakte eines Subunternehmens auflisten' })
  listContacts(@Param('id') id: string) {
    return this.subcontractors.listContacts(id);
  }

  /**
   * Legt einen Kontakt an.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreateSubcontractorContactDto)
   * @returns Neuer Kontakt
   */

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Kontakt anlegen' })
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateSubcontractorContactDto,
  ) {
    return this.subcontractors.createContact(id, dto);
  }

  /**
   * Aktualisiert einen Kontakt.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param contactId - ID (contactId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSubcontractorContactDto)
   * @returns Aktualisierter Kontakt
   */

  @Patch(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Kontakt bearbeiten' })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSubcontractorContactDto,
  ) {
    return this.subcontractors.updateContact(id, contactId, dto);
  }

  /**
   * Entfernt einen Kontakt.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param contactId - ID (contactId) (string)
   * @returns Ergebnis
   */

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Kontakt löschen' })
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.subcontractors.removeContact(id, contactId);
  }
}
