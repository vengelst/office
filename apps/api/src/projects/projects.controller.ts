/**
 * HTTP-API für Projects.
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
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { CreateEmailRecipientDto } from './dto/create-email-recipient.dto';
import { UpdateEmailRecipientDto } from './dto/update-email-recipient.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

/**
 * Controller für die Projektverwaltung.
 * Stellt Endpunkte für Projekt-CRUD, Status-Workflow, Standorte,
 * Geräte, E-Mail-Verteiler, Notizen und Monteur-Zuordnungen bereit.
 */
@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  /**
   * Liefert eine Zeitachse/Projekt-Timeline.
   *
   * @param from - Zeitraum-Beginn (string)
   * @param to - Zeitraum-Ende (string)
   * @param customerId - ID des Kunden (string)
   * @param activeOnly - Parameter `activeOnly` (string)
   * @returns Timeline-Daten
   */

  @Get('timeline')
  @ApiOperation({ summary: 'Projekte im Zeitraum (Kalender/Timeline)' })
  timeline(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerId') customerId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.projects.timeline(
      from,
      to,
      customerId,
      activeOnly === 'true' || activeOnly === '1',
    );
  }

  /**
   * Listet Benutzer für Auswahlfelder.
   *
   * @returns Benutzer-Liste
   */

  @Get('meta/users')
  @ApiOperation({ summary: 'Aktive Benutzer (für Projektleiter-Auswahl)' })
  listUsers() {
    return this.projects.listUsers();
  }

  @Get('meta/workers')
  @ApiOperation({
    summary:
      'Aktive Monteure (für Zuordnungs-Auswahl); optional nur freie im Zeitraum',
  })
  /**
   * Listet Monteure für Auswahlfelder.
   *
   * @param from - Zeitraum-Beginn (string)
   * @param to - Zeitraum-Ende (string)
   * @param availableOnly - Parameter `availableOnly` (string)
   * @returns Monteur-Liste
   */
  listWorkers(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('availableOnly') availableOnly?: string,
  ) {
    return this.projects.listWorkers({
      from,
      to,
      availableOnly:
        availableOnly === 'true' || availableOnly === '1',
    });
  }

  // ── Projekt CRUD ─────────────────────────────────────────────

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param status - Zielstatus (string)
   * @param customerId - ID des Kunden (string)
   * @param serviceType - Parameter `serviceType` (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Projekte auflisten (Paginierung, Suche, Filter)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.projects.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      customerId,
      serviceType,
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
  @ApiOperation({ summary: 'Einzelprojekt mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateProjectDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Projekt anlegen (Projektnummer automatisch)' })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateProjectDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Projekt bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
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
    return this.projects.bulkRemove(dto.ids);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Projekt löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  // ── Status-Workflow ──────────────────────────────────────────

  /**
   * Ändert den Projektstatus.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateStatusDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   */

  @Post(':id/status')
  @ApiOperation({ summary: 'Status ändern (protokolliert in StatusHistory)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.changeStatus(
      id,
      dto,
      user.type === 'user' ? user.id : null,
    );
  }

  // ── Sites ────────────────────────────────────────────────────

  /**
   * Listet Projektstandorte.
   *
   * @param projectId - ID des Projekts (string)
   */

  @Get(':projectId/sites')
  findSites(@Param('projectId') projectId: string) {
    return this.projects.findSites(projectId);
  }

  /**
   * Legt einen Projektstandort an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateSiteDto)
   * @returns Neuer Standort
   */

  @Post(':projectId/sites')
  createSite(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSiteDto,
  ) {
    return this.projects.createSite(projectId, dto);
  }

  /**
   * Aktualisiert einen Projektstandort.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateSiteDto)
   * @returns Aktualisierter Standort
   */

  @Patch(':projectId/sites/:id')
  updateSite(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.projects.updateSite(projectId, id, dto);
  }

  /**
   * Entfernt einen Projektstandort.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis
   */

  @Delete(':projectId/sites/:id')
  removeSite(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.projects.removeSite(projectId, id);
  }

  // ── Equipment ────────────────────────────────────────────────

  /**
   * Listet Equipment der Entität.
   *
   * @param projectId - ID des Projekts (string)
   * @returns Equipment-Liste
   */

  @Get(':projectId/equipment')
  findEquipment(@Param('projectId') projectId: string) {
    return this.projects.findEquipment(projectId);
  }

  /**
   * Legt Equipment an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateEquipmentDto)
   * @returns Neues Equipment
   */

  @Post(':projectId/equipment')
  createEquipment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEquipmentDto,
  ) {
    return this.projects.createEquipment(projectId, dto);
  }

  /**
   * Aktualisiert Equipment.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateEquipmentDto)
   * @returns Aktualisiertes Equipment
   */

  @Patch(':projectId/equipment/:id')
  updateEquipment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.projects.updateEquipment(projectId, id, dto);
  }

  /**
   * Entfernt Equipment.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis
   */

  @Delete(':projectId/equipment/:id')
  removeEquipment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeEquipment(projectId, id);
  }

  // ── E-Mail-Verteiler ─────────────────────────────────────────

  /**
   * Listet E-Mail-Empfänger des Projekts.
   *
   * @param projectId - ID des Projekts (string)
   */

  @Get(':projectId/email-recipients')
  findEmailRecipients(@Param('projectId') projectId: string) {
    return this.projects.findEmailRecipients(projectId);
  }

  /**
   * Legt einen E-Mail-Empfänger an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateEmailRecipientDto)
   */

  @Post(':projectId/email-recipients')
  createEmailRecipient(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEmailRecipientDto,
  ) {
    return this.projects.createEmailRecipient(projectId, dto);
  }

  /**
   * Aktualisiert einen E-Mail-Empfänger.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateEmailRecipientDto)
   */

  @Patch(':projectId/email-recipients/:id')
  updateEmailRecipient(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailRecipientDto,
  ) {
    return this.projects.updateEmailRecipient(projectId, id, dto);
  }

  /**
   * Entfernt einen E-Mail-Empfänger.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   */

  @Delete(':projectId/email-recipients/:id')
  removeEmailRecipient(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeEmailRecipient(projectId, id);
  }

  // ── Notizen ──────────────────────────────────────────────────

  /**
   * Listet Projektnotizen.
   *
   * @param projectId - ID des Projekts (string)
   */

  @Get(':projectId/notes')
  findNotes(@Param('projectId') projectId: string) {
    return this.projects.findNotes(projectId);
  }

  /**
   * Legt eine Projektnotiz an.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateNoteDto)
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   */

  @Post(':projectId/notes')
  createNote(
    @Param('projectId') projectId: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.createNote(projectId, dto, user.id);
  }

  /**
   * Entfernt eine Projektnotiz.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   */

  @Delete(':projectId/notes/:id')
  removeNote(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.projects.removeNote(projectId, id);
  }

  // ── Monteur-Zuordnungen ──────────────────────────────────────

  /**
   * Listet Monteur-/Team-Zuordnungen am Projekt.
   *
   * @param projectId - ID des Projekts (string)
   */

  @Get(':projectId/assignments')
  findAssignments(@Param('projectId') projectId: string) {
    return this.projects.findAssignments(projectId);
  }

  /**
   * Erstellt eine Projektzuordnung.
   *
   * @param projectId - ID des Projekts (string)
   * @param dto - Request-Body / Eingabedaten (CreateAssignmentDto)
   */

  @Post(':projectId/assignments')
  createAssignment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.projects.createAssignment(projectId, dto);
  }

  /**
   * Aktualisiert eine Projektzuordnung.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateAssignmentDto)
   */

  @Patch(':projectId/assignments/:id')
  updateAssignment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.projects.updateAssignment(projectId, id, dto);
  }

  /**
   * Entfernt eine Projektzuordnung.
   *
   * @param projectId - ID des Projekts (string)
   * @param id - Primärschlüssel der Entität (string)
   */

  @Delete(':projectId/assignments/:id')
  removeAssignment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeAssignment(projectId, id);
  }
}
