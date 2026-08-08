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

  @Get()
  @ApiOperation({ summary: 'Alle Templates (optional gefiltert nach Kunde)' })
  findAll(@Query('customerId') customerId?: string) {
    return this.templates.findAll(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Template-Detail' })
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Template anlegen' })
  create(@Body() dto: CreateWorkCardTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Template bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkCardTemplateDto) {
    return this.templates.update(id, dto);
  }

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
  runCalibrate(@UploadedFile() file: Express.Multer.File) {
    return this.calibrate.calibrate(file);
  }
}
