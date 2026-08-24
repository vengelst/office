/**
 * HTTP-API für Timesheets.
 * Leitet Anfragen an den zugehörigen Service weiter und definiert Swagger-Metadaten.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { TimesheetsService } from './timesheets.service';
import { TimesheetPdfService } from './pdf.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpsertDayDto } from './dto/upsert-day.dto';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';

/**
 * Controller für die Stundenzettel-Verwaltung.
 * Stellt Endpunkte für Generierung, Workflow (Einreichen, Genehmigen, Zurückweisen),
 * Tageskorrektur, Unterschriften und PDF-Export bereit.
 *
 * Der Kunden-PL (`CUSTOMER_PL`) ist bewusst nur für die lesenden Endpunkte und
 * das Abzeichnen (`approve`) freigeschaltet – und dort zusätzlich auf seine
 * zugewiesenen Projekte beschränkt (SPEZ-arbeitsitems.md 4.2/8.1).
 * Generieren, Korrigieren, Einreichen, Zurückweisen, Archivieren und
 * Unterschreiben bleiben den internen Rollen vorbehalten.
 */
@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('timesheets')
@Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER')
@Controller('timesheets')
export class TimesheetsController {
  constructor(
    private readonly timesheets: TimesheetsService,
    private readonly pdf: TimesheetPdfService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({
    summary:
      'Stundenzettel auflisten (Filter, Pagination); Kunden-PL nur eigene Projekte',
  })
  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param workerId - ID des Monteurs (string)
   * @param projectId - ID des Projekts (string)
   * @param weekYear - Parameter `weekYear` (string)
   * @param weekNumber - Parameter `weekNumber` (string)
   * @param status - Zielstatus (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workerId') workerId?: string,
    @Query('projectId') projectId?: string,
    @Query('weekYear') weekYear?: string,
    @Query('weekNumber') weekNumber?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.timesheets.findAll(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        workerId,
        projectId,
        weekYear: weekYear ? Number(weekYear) : undefined,
        weekNumber: weekNumber ? Number(weekNumber) : undefined,
        status,
        sortBy,
        sortDir,
      },
      user,
    );
  }

  /**
   * Generiert Dokumente/Einträge (PDF, Stundenzettel o. Ä.).
   *
   * @param dto - Request-Body / Eingabedaten (GenerateTimesheetDto)
   * @returns Generiertes Ergebnis
   */

  @Post('generate')
  @ApiOperation({ summary: 'Stundenzettel aus Stempel-Einträgen generieren' })
  generate(@Body() dto: GenerateTimesheetDto) {
    return this.timesheets.generate(dto);
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Datensatz
   */

  @Get(':id')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({ summary: 'Stundenzettel-Detail (Tage + Unterschriften)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.findOneForUser(id, user);
  }

  /**
   * Aktualisiert einen Tageseintrag im Stundenzettel.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dayId - ID (dayId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateDayDto)
   * @returns Aktualisierter Tag
   */

  @Post(':id/days')
  @ApiOperation({
    summary:
      'Tag manuell anlegen/überschreiben (z. B. Monteur ohne Handy)',
  })
  upsertDay(@Param('id') id: string, @Body() dto: UpsertDayDto) {
    return this.timesheets.upsertDay(id, dto);
  }

  @Patch(':id/days/:dayId')
  @ApiOperation({ summary: 'Tageseintrag korrigieren' })
  updateDay(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateDayDto,
  ) {
    return this.timesheets.updateDay(id, dayId, dto);
  }

  /**
   * Reicht den Stundenzettel zur Freigabe ein.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Aktualisierter Stundenzettel
   */

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel einreichen' })
  submit(@Param('id') id: string) {
    return this.timesheets.submit(id);
  }

  @Post(':id/approve')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stundenzettel genehmigen / abzeichnen (Kunden-PL: eigene Projekte)',
  })
  /**
   * Gibt den Stundenzettel bzw. das Item frei.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Freigegebenes Objekt
   */
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timesheets.approveForUser(id, user);
  }

  /**
   * Archiviert den Stundenzettel.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Archivierter Stundenzettel
   */

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel archivieren (nur bei APPROVED)' })
  archive(@Param('id') id: string) {
    return this.timesheets.archive(id);
  }

  /**
   * Lehnt den Stundenzettel ab.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (RejectTimesheetDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Abgelehnter Stundenzettel
   */

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stundenzettel zurückweisen (mit Grund)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTimesheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timesheets.reject(
      id,
      dto.reason,
      user.type === 'user' ? user.id : null,
    );
  }

  @Post(':id/sign')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Digitale Unterschrift (Base64-PNG); Kunden-PL nur Typ CUSTOMER auf eigenen Projekten',
  })
  /**
   * Erfasst die Unterschrift / Abzeichnung.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (SignTimesheetDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @param ip - Parameter `ip` (string)
   * @param userAgent - Parameter `userAgent` (string)
   */
  sign(
    @Param('id') id: string,
    @Body() dto: SignTimesheetDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.timesheets.signForUser(id, dto, user, {
      ipAddress: ip,
      deviceInfo: userAgent,
    });
  }

  /**
   * Erzeugt bzw. liefert das PDF-Dokument.
   */

  @Get(':id/pdf')
  @Roles('SUPERADMIN', 'OFFICE', 'PROJECT_MANAGER', 'CUSTOMER_PL')
  @ApiOperation({ summary: 'Stundenzettel als PDF exportieren' })
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.timesheets.findOneForUser(id, user);
    const { buffer, filename } = await this.pdf.generate(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        filename,
      )}"`,
    });
    return new StreamableFile(buffer);
  }
}
