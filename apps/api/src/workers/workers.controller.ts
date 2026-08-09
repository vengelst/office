/**
 * HTTP-API für Workers.
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
  Res,
  StreamableFile,
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
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WorkersService, MAX_PHOTO_SIZE } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

/**
 * Controller für die Monteur-Verwaltung.
 * Stellt Endpunkte für CRUD, Profilbilder, Sprachkenntnisse,
 * Zertifikate, PIN-Verwaltung und Ablaufwarnungen bereit.
 */
@ApiTags('workers')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('workers')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  /**
   * Liefert Nationalitäten-Stammdaten.
   *
   * @returns Liste
   */

  @Get('nationalities')
  @ApiOperation({ summary: 'Alle bisher eingetragenen Nationalitäten' })
  nationalities() {
    return this.workers.getNationalities();
  }

  @Get('expiring-documents')
  @ApiOperation({
    summary: 'Monteure mit ablaufenden Reisedokumenten (< 30 Tage)',
  })
  /**
   * Listet bald ablaufende Dokumente.
   *
   * @returns Liste
   */
  expiringDocuments() {
    return this.workers.expiringDocuments();
  }

  // ── Monteur CRUD ─────────────────────────────────────────────

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param type - Parameter `type` (string)
   * @param availability - Parameter `availability` (string)
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param teamId - ID (teamId) (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Monteure auflisten (Suche, Filter, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('availability') availability?: string,
    @Query('subcontractorId') subcontractorId?: string,
    @Query('teamId') teamId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.workers.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      type,
      availability,
      subcontractorId,
      teamId,
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
  @ApiOperation({ summary: 'Monteur-Detail mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.workers.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateWorkerDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Monteur anlegen (Nummer automatisch W-YYYY-NNNN)' })
  create(@Body() dto: CreateWorkerDto) {
    return this.workers.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateWorkerDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Monteur bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.workers.update(id, dto);
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
    return this.workers.bulkRemove(dto.ids);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Monteur löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.workers.remove(id);
  }

  // ── Profilbild ───────────────────────────────────────────────

  @Post(':id/photo')
  @ApiOperation({ summary: 'Profilbild hochladen (JPEG/PNG, max. 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE } }),
  )
  /**
   * Lädt ein Stempel-/Nachweisfoto hoch.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File | undefined)
   * @returns Upload-Ergebnis
   */
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.workers.uploadPhoto(id, file);
  }

  /**
   * Liefert das Monteur-Foto.
   */

  @Get(':id/photo')
  @ApiOperation({ summary: 'Profilbild abrufen (Stream)' })
  async getPhoto(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.workers.getPhoto(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }

  // ── Sprachkenntnisse ─────────────────────────────────────────

  /**
   * Listet Sprachen eines Monteurs.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Sprachliste
   */

  @Get(':id/languages')
  findLanguages(@Param('id') id: string) {
    return this.workers.findLanguages(id);
  }

  /**
   * Fügt eine Sprache hinzu.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreateLanguageDto)
   * @returns Neue Sprache
   */

  @Post(':id/languages')
  createLanguage(@Param('id') id: string, @Body() dto: CreateLanguageDto) {
    return this.workers.createLanguage(id, dto);
  }

  /**
   * Aktualisiert eine Sprache.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param langId - ID (langId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateLanguageDto)
   * @returns Aktualisierte Sprache
   */

  @Patch(':id/languages/:langId')
  updateLanguage(
    @Param('id') id: string,
    @Param('langId') langId: string,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.workers.updateLanguage(id, langId, dto);
  }

  /**
   * Entfernt eine Sprache.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param langId - ID (langId) (string)
   * @returns Ergebnis
   */

  @Delete(':id/languages/:langId')
  removeLanguage(@Param('id') id: string, @Param('langId') langId: string) {
    return this.workers.removeLanguage(id, langId);
  }

  // ── Zertifikate ──────────────────────────────────────────────

  /**
   * Listet Zertifikate eines Monteurs.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Zertifikatsliste
   */

  @Get(':id/certifications')
  findCertifications(@Param('id') id: string) {
    return this.workers.findCertifications(id);
  }

  /**
   * Legt ein Zertifikat an.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (CreateCertificationDto)
   */

  @Post(':id/certifications')
  createCertification(
    @Param('id') id: string,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.workers.createCertification(id, dto);
  }

  /**
   * Aktualisiert ein Zertifikat.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param certId - ID (certId) (string)
   * @param dto - Request-Body / Eingabedaten (UpdateCertificationDto)
   */

  @Patch(':id/certifications/:certId')
  updateCertification(
    @Param('id') id: string,
    @Param('certId') certId: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    return this.workers.updateCertification(id, certId, dto);
  }

  /**
   * Entfernt ein Zertifikat.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param certId - ID (certId) (string)
   */

  @Delete(':id/certifications/:certId')
  removeCertification(
    @Param('id') id: string,
    @Param('certId') certId: string,
  ) {
    return this.workers.removeCertification(id, certId);
  }

  // ── PIN-Verwaltung ────────────────────────────────────────────

  /**
   * Setzt oder aktualisiert die PIN eines Benutzers.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param body - Parameter `body` ({ pin: string })
   * @returns Ergebnis
   */

  @Post(':id/pin')
  @ApiOperation({ summary: 'PIN für Monteur setzen (6 Ziffern)' })
  setPin(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.workers.setPin(id, body.pin);
  }

  /**
   * Sendet die PIN per E-Mail an den Monteur.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param body - Parameter `body` ({ pin: string })
   */

  @Post(':id/send-pin-email')
  @ApiOperation({ summary: 'PIN setzen und per E-Mail an Monteur senden' })
  sendPinEmail(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.workers.sendPinEmail(id, body.pin);
  }
}
