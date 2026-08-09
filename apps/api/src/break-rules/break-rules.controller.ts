/**
 * HTTP-API für Break Rules.
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
import { BreakRulesService } from './break-rules.service';
import { CreateBreakRuleDto } from './dto/create-break-rule.dto';
import { UpdateBreakRuleDto } from './dto/update-break-rule.dto';

@ApiTags('break-rules')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('break-rules')
export class BreakRulesController {
  constructor(private readonly breakRules: BreakRulesService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param projectId - ID des Projekts (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Pausenregeln (global + projektspezifisch)' })
  findAll(@Query('projectId') projectId?: string) {
    return this.breakRules.findAll(projectId);
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Pausenregel' })
  findOne(@Param('id') id: string) {
    return this.breakRules.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateBreakRuleDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Pausenregel erstellen' })
  create(@Body() dto: CreateBreakRuleDto) {
    return this.breakRules.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateBreakRuleDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Pausenregel bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateBreakRuleDto) {
    return this.breakRules.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Pausenregel löschen' })
  remove(@Param('id') id: string) {
    return this.breakRules.remove(id);
  }
}
