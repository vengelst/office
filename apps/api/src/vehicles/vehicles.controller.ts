/**
 * HTTP-API für Vehicles.
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
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';

/**
 * Controller für die Fahrzeugverwaltung.
 * Stellt Endpunkte für CRUD, Aktivierung/Deaktivierung,
 * Monteur-Zuweisungen und Ablaufwarnungen bereit.
 */
@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

  @Get('expiring')
  @ApiOperation({
    summary: 'Fahrzeuge mit ablaufendem TÜV/Versicherung (< 30 Tage)',
  })
  /**
   * Listet bald ablaufende Einträge.
   *
   * @returns Liste
   */
  expiring() {
    return this.vehicles.findExpiring();
  }

  /**
   * Listet Monteure für Auswahlfelder.
   *
   * @returns Monteur-Liste
   */

  @Get('meta/workers')
  @ApiOperation({ summary: 'Aktive Monteure (für Zuweisungs-Auswahl)' })
  listWorkers() {
    return this.vehicles.listWorkers();
  }

  // ── Fahrzeug CRUD ────────────────────────────────────────────

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @param search - Freitextsuche (string)
   * @param ownerType - Parameter `ownerType` (string)
   * @param category - Parameter `category` (string)
   * @param subcontractorId - ID (subcontractorId) (string)
   * @param status - Zielstatus (string)
   * @param active - Parameter `active` (string)
   * @param sortBy - Parameter `sortBy` (string)
   * @param sortDir - Parameter `sortDir` ('asc' | 'desc')
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Fahrzeuge auflisten (Filter, Suche, Pagination)' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('ownerType') ownerType?: string,
    @Query('category') category?: string,
    @Query('subcontractorId') subcontractorId?: string,
    @Query('status') status?: string,
    @Query('active') active?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.vehicles.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      ownerType,
      category,
      subcontractorId,
      status,
      active:
        active === undefined ? undefined : active === 'true' || active === '1',
      sortBy,
      sortDir,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fahrzeug-Detail mit aktueller Zuweisung + Historie',
  })
  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */
  findOne(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateVehicleDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Fahrzeug anlegen' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateVehicleDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Fahrzeug bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto);
  }

  /**
   * Deaktiviert den Datensatz (Soft-Delete/Status).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Deaktivierter Datensatz
   */

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Fahrzeug deaktivieren (active=false)' })
  deactivate(@Param('id') id: string) {
    return this.vehicles.deactivate(id);
  }

  /**
   * Reaktiviert einen zuvor deaktivierten Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Reaktivierter Datensatz
   */

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Fahrzeug reaktivieren (active=true)' })
  reactivate(@Param('id') id: string) {
    return this.vehicles.reactivate(id);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Fahrzeug löschen (Hard-Delete oder Deaktivierung als Fallback)' })
  remove(@Param('id') id: string) {
    return this.vehicles.remove(id);
  }

  // ── Zuweisungen ──────────────────────────────────────────────

  /**
   * Erstellt eine Zuordnung.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (AssignVehicleDto)
   * @returns Zuordnung
   */

  @Post(':id/assign')
  @ApiOperation({ summary: 'Monteur zuweisen (alte Zuweisung wird beendet)' })
  assign(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    return this.vehicles.assign(id, dto);
  }

  /**
   * Hebt eine Zuordnung auf.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Aktualisierter Datensatz
   */

  @Post(':id/unassign')
  @ApiOperation({ summary: 'Aktuelle Zuweisung beenden' })
  unassign(@Param('id') id: string) {
    return this.vehicles.unassign(id);
  }
}
