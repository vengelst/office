/**
 * HTTP-API für Communication.
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
import {
  CommunicationEntityType,
  CommunicationType,
  RoleCode,
} from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommunicationService } from './communication.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

@ApiTags('communication')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communication: CommunicationService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param entityType - Entitätstyp (Customer, Project, …) (CommunicationEntityType)
   * @param entityId - ID der verknüpften Entität (string)
   * @param contactId - ID (contactId) (string)
   * @param type - Parameter `type` (CommunicationType)
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Kommunikationseinträge auflisten (Paginierung, Filter)' })
  findAll(
    @Query('entityType') entityType?: CommunicationEntityType,
    @Query('entityId') entityId?: string,
    @Query('contactId') contactId?: string,
    @Query('type') type?: CommunicationType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communication.list({
      entityType,
      entityId,
      contactId,
      type,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Kommunikationseintrag laden' })
  findOne(@Param('id') id: string) {
    return this.communication.get(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateCommunicationDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Kommunikationseintrag erstellen' })
  create(@Body() dto: CreateCommunicationDto) {
    return this.communication.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateCommunicationDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateCommunicationDto) {
    return this.communication.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Kommunikationseintrag löschen' })
  remove(@Param('id') id: string) {
    return this.communication.remove(id);
  }
}
