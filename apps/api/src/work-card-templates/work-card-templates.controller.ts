/**
 * HTTP-API für Work Card Templates.
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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateWorkCardTemplateDto,
  UpdateWorkCardTemplateDto,
} from './dto/work-card-template.dto';
import { WorkCardCalibrateService } from './work-card-calibrate.service';
import { WorkCardTemplatesService } from './work-card-templates.service';

/**
 * CRUD + Calibrate für Kartentyp-Templates.
 * Rollen analog zu den Work-Items-Routen.
 */
@ApiTags('work-card-templates')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('work-card-templates')
export class WorkCardTemplatesController {
  constructor(
    private readonly templates: WorkCardTemplatesService,
    private readonly calibrate: WorkCardCalibrateService,
  ) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param customerId - ID des Kunden (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Alle Templates (optional gefiltert nach Kunde)' })
  findAll(@Query('customerId') customerId?: string) {
    return this.templates.findAll(customerId);
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Template-Detail' })
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateWorkCardTemplateDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Template anlegen' })
  create(@Body() dto: CreateWorkCardTemplateDto) {
    return this.templates.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateWorkCardTemplateDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Template bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkCardTemplateDto) {
    return this.templates.update(id, dto);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Template löschen' })
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }

  @Post('calibrate')
  @ApiOperation({
    summary: 'Beispielseite → OCR → Rohtext + Feldvorschläge',
    description:
      'Multipart-Feld "file" mit Bild oder 1-Seiten-PDF. ' +
      'Liefert OCR-Text, Blöcke und heuristische Feldzuordnungs-Vorschläge.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  /**
   * Startet die Template-Kalibrierung.
   *
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File)
   * @returns Kalibrierungsergebnis
   */
  runCalibrate(@UploadedFile() file: Express.Multer.File) {
    return this.calibrate.calibrate(file);
  }
}
