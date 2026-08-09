/**
 * HTTP-API für Work Items.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReplaceMaterialsDto, UpdateWorkItemDto } from './dto/work-item.dto';
import { WorkItemWorkflowService } from './work-item-workflow.service';
import { WorkItemsService } from './work-items.service';

/**
 * Büro-/Admin-Endpunkte auf einzelnen Arbeitsitems.
 *
 *  - `GET            /work-items/:id`            Detail inkl. Material, Zuordnungen, Meldungen
 *  - `PATCH          /work-items/:id`            Metadaten pflegen (kein Statuswechsel)
 *  - `DELETE         /work-items/:id`            Item samt Material/Historie löschen
 *  - `GET|PUT        /work-items/:id/materials`  Materialliste lesen/ersetzen
 *  - `GET            /work-items/:id/time`       Item-Zeit je Monteur
 */
@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('work-items')
export class WorkItemsController {
  constructor(
    private readonly workItems: WorkItemsService,
    private readonly workflow: WorkItemWorkflowService,
  ) {}

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Item-Detail (Material, Zuordnungen, Meldungen, Prüfungen)' })
  findOne(@Param('id') id: string) {
    return this.workItems.findOne(id);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateWorkItemDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Item-Metadaten ändern (Status läuft über den Workflow)' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkItemDto) {
    return this.workItems.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Item löschen' })
  remove(@Param('id') id: string) {
    return this.workItems.remove(id);
  }

  /**
   * Listet Materialien eines Work-Items.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Material-Liste
   */

  @Get(':id/materials')
  @ApiOperation({ summary: 'Materialliste des Items' })
  findMaterials(@Param('id') id: string) {
    return this.workItems.findMaterials(id);
  }

  /**
   * Ersetzt die Materialliste eines Work-Items.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (ReplaceMaterialsDto)
   * @returns Aktualisierte Materialien
   */

  @Put(':id/materials')
  @ApiOperation({ summary: 'Materialliste vollständig ersetzen' })
  replaceMaterials(@Param('id') id: string, @Body() dto: ReplaceMaterialsDto) {
    return this.workItems.replaceMaterials(id, dto);
  }

  /**
   * Liefert die dem Item zugeordnete Stempelzeit.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Zeitaggregation
   */

  @Get(':id/time')
  @ApiOperation({ summary: 'Item-Zeit: Summe je Monteur und alle Sessions' })
  itemTime(@Param('id') id: string) {
    return this.workflow.itemTime(id);
  }
}
