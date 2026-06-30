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
  expiring() {
    return this.vehicles.findExpiring();
  }

  @Get('meta/workers')
  @ApiOperation({ summary: 'Aktive Monteure (für Zuweisungs-Auswahl)' })
  listWorkers() {
    return this.vehicles.listWorkers();
  }

  // ── Fahrzeug CRUD ────────────────────────────────────────────

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
  findOne(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Fahrzeug anlegen' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Fahrzeug bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Fahrzeug deaktivieren (kein Hard-Delete)' })
  remove(@Param('id') id: string) {
    return this.vehicles.remove(id);
  }

  // ── Zuweisungen ──────────────────────────────────────────────

  @Post(':id/assign')
  @ApiOperation({ summary: 'Monteur zuweisen (alte Zuweisung wird beendet)' })
  assign(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    return this.vehicles.assign(id, dto);
  }

  @Post(':id/unassign')
  @ApiOperation({ summary: 'Aktuelle Zuweisung beenden' })
  unassign(@Param('id') id: string) {
    return this.vehicles.unassign(id);
  }
}
