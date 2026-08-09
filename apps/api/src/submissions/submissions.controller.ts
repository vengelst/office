/**
 * HTTP-API für Submissions.
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
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

/**
 * Controller für die Ausschreibungsverwaltung.
 * Stellt CRUD-Endpunkte für Ausschreibungen bereit.
 */
@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /**
   * Listet Ausschreibungen, optional gefiltert nach Kunde und Status. GET /api/submissions.
   *
   * @param customerId - ID des Kunden (string)
   * @param status - Zielstatus (string)
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Ausschreibungen auflisten (Paginierung)' })
  findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissions.findAll({
      customerId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Liefert eine einzelne Ausschreibung. GET /api/submissions/:id.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Ausschreibung Detail' })
  findOne(@Param('id') id: string) {
    return this.submissions.findOne(id);
  }

  /**
   * Erstellt eine neue Ausschreibung. POST /api/submissions.
   *
   * @param dto - Request-Body / Eingabedaten (CreateSubmissionDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Ausschreibung anlegen' })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissions.create(dto);
  }

  /**
   * Aktualisiert eine bestehende Ausschreibung. PATCH /api/submissions/:id.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSubmissionDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Ausschreibung bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateSubmissionDto) {
    return this.submissions.update(id, dto);
  }

  /**
   * Soft-Delete einer Ausschreibung. DELETE /api/submissions/:id.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Ausschreibung löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.submissions.remove(id);
  }
}
