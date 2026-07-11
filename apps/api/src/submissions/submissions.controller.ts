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
   * Listet alle Ausschreibungen, optional gefiltert nach Kunde und Status.
   * GET /api/submissions
   */
  @Get()
  @ApiOperation({ summary: 'Ausschreibungen auflisten' })
  findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.submissions.findAll({ customerId, status });
  }

  /**
   * Liefert eine einzelne Ausschreibung.
   * GET /api/submissions/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Ausschreibung Detail' })
  findOne(@Param('id') id: string) {
    return this.submissions.findOne(id);
  }

  /**
   * Erstellt eine neue Ausschreibung.
   * POST /api/submissions
   */
  @Post()
  @ApiOperation({ summary: 'Ausschreibung anlegen' })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissions.create(dto);
  }

  /**
   * Aktualisiert eine bestehende Ausschreibung.
   * PATCH /api/submissions/:id
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Ausschreibung bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateSubmissionDto) {
    return this.submissions.update(id, dto);
  }

  /**
   * Soft-Delete einer Ausschreibung.
   * DELETE /api/submissions/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Ausschreibung löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.submissions.remove(id);
  }
}
