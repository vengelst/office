/**
 * HTTP-API für Equipment.
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
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { AssignEquipmentDto } from './dto/assign-equipment.dto';
import { ReturnEquipmentDto } from './dto/return-equipment.dto';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Controller für das Werkzeug- & Gerätemanagement.
 * CRUD, Bild-Upload, Ausgabe an Monteure und Rückgabe.
 */
@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  // ── Statische Routen ──────────────────────────────────────────

  /**
   * Listet Monteure für Auswahlfelder.
   *
   * @returns Monteur-Liste
   */

  @Get('meta/workers')
  @ApiOperation({ summary: 'Aktive Monteure (für Zuweisungs-Auswahl)' })
  listWorkers() {
    return this.equipment.listWorkers();
  }

  /**
   * Listet Kategorien.
   *
   * @returns Kategorie-Liste
   */

  @Get('meta/categories')
  @ApiOperation({ summary: 'Vorhandene Kategorien' })
  listCategories() {
    return this.equipment.listCategories();
  }

  /**
   * Listet dem Monteur zugewiesenes Equipment.
   *
   * @param workerId - ID des Monteurs (string)
   * @returns Equipment-Liste
   */

  @Get('worker/:workerId')
  @ApiOperation({ summary: 'Aktuelle Geräte eines Monteurs' })
  getWorkerEquipment(@Param('workerId') workerId: string) {
    return this.equipment.getWorkerEquipment(workerId);
  }

  // ── CRUD ──────────────────────────────────────────────────────

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param status - Zielstatus (string)
   * @param category - Parameter `category` (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Geräte auflisten (Filter, Suche, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.equipment.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      category,
    });
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Geräte-Detail mit Zuweisungen' })
  findOne(@Param('id') id: string) {
    return this.equipment.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateEquipmentDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Gerät anlegen' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.equipment.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateEquipmentDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Gerät bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipment.update(id, dto);
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
    return this.equipment.bulkRemove(dto.ids);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Gerät löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.equipment.remove(id);
  }

  // ── Bild ──────────────────────────────────────────────────────

  @Post(':id/image')
  @ApiOperation({ summary: 'Gerätebild hochladen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  /**
   * Lädt ein Bild hoch.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param file - Hochgeladene Datei (Multer) (Express.Multer.File)
   * @returns Bild-Metadaten
   */
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.equipment.uploadImage(id, file);
  }

  /**
   * Liefert Bilddaten bzw. Stream.
   *
   * @returns Bild
   */

  @Get(':id/image')
  @ApiOperation({ summary: 'Gerätebild abrufen (Stream)' })
  async getImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.equipment.getImage(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }

  // ── Zuweisungen ───────────────────────────────────────────────

  /**
   * Erstellt eine Zuordnung.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (AssignEquipmentDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Zuordnung
   */

  @Post(':id/assign')
  @ApiOperation({ summary: 'Gerät an Monteur ausgeben' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignEquipmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.assign(id, dto, user?.id);
  }

  /**
   * Nimmt ausgeliehenes Equipment zurück (Rückgabe-Buchung).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (ReturnEquipmentDto)
   */

  @Post(':id/return')
  @ApiOperation({ summary: 'Rückgabe registrieren' })
  returnEquipment(
    @Param('id') id: string,
    @Body() dto: ReturnEquipmentDto,
  ) {
    return this.equipment.returnEquipment(id, dto);
  }

}
