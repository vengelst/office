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

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ── Statische Routen zuerst (vor :id) ────────────────────────

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

  @Get('meta/users')
  @ApiOperation({ summary: 'Aktive Benutzer (für Projektleiter-Auswahl)' })
  listUsers() {
    return this.projects.listUsers();
  }

  @Get('meta/workers')
  @ApiOperation({ summary: 'Aktive Monteure (für Zuordnungs-Auswahl)' })
  listWorkers() {
    return this.projects.listWorkers();
  }

  // ── Projekt CRUD ─────────────────────────────────────────────

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

  @Get(':id')
  @ApiOperation({ summary: 'Einzelprojekt mit allen Relationen' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Projekt anlegen (Projektnummer automatisch)' })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Projekt bearbeiten' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Projekt löschen (Soft-Delete)' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  // ── Status-Workflow ──────────────────────────────────────────

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

  @Get(':projectId/sites')
  findSites(@Param('projectId') projectId: string) {
    return this.projects.findSites(projectId);
  }

  @Post(':projectId/sites')
  createSite(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSiteDto,
  ) {
    return this.projects.createSite(projectId, dto);
  }

  @Patch(':projectId/sites/:id')
  updateSite(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.projects.updateSite(projectId, id, dto);
  }

  @Delete(':projectId/sites/:id')
  removeSite(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.projects.removeSite(projectId, id);
  }

  // ── Equipment ────────────────────────────────────────────────

  @Get(':projectId/equipment')
  findEquipment(@Param('projectId') projectId: string) {
    return this.projects.findEquipment(projectId);
  }

  @Post(':projectId/equipment')
  createEquipment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEquipmentDto,
  ) {
    return this.projects.createEquipment(projectId, dto);
  }

  @Patch(':projectId/equipment/:id')
  updateEquipment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.projects.updateEquipment(projectId, id, dto);
  }

  @Delete(':projectId/equipment/:id')
  removeEquipment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeEquipment(projectId, id);
  }

  // ── E-Mail-Verteiler ─────────────────────────────────────────

  @Get(':projectId/email-recipients')
  findEmailRecipients(@Param('projectId') projectId: string) {
    return this.projects.findEmailRecipients(projectId);
  }

  @Post(':projectId/email-recipients')
  createEmailRecipient(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEmailRecipientDto,
  ) {
    return this.projects.createEmailRecipient(projectId, dto);
  }

  @Patch(':projectId/email-recipients/:id')
  updateEmailRecipient(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailRecipientDto,
  ) {
    return this.projects.updateEmailRecipient(projectId, id, dto);
  }

  @Delete(':projectId/email-recipients/:id')
  removeEmailRecipient(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeEmailRecipient(projectId, id);
  }

  // ── Notizen ──────────────────────────────────────────────────

  @Get(':projectId/notes')
  findNotes(@Param('projectId') projectId: string) {
    return this.projects.findNotes(projectId);
  }

  @Post(':projectId/notes')
  createNote(
    @Param('projectId') projectId: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.createNote(projectId, dto, user.id);
  }

  @Delete(':projectId/notes/:id')
  removeNote(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.projects.removeNote(projectId, id);
  }

  // ── Monteur-Zuordnungen ──────────────────────────────────────

  @Get(':projectId/assignments')
  findAssignments(@Param('projectId') projectId: string) {
    return this.projects.findAssignments(projectId);
  }

  @Post(':projectId/assignments')
  createAssignment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.projects.createAssignment(projectId, dto);
  }

  @Patch(':projectId/assignments/:id')
  updateAssignment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.projects.updateAssignment(projectId, id, dto);
  }

  @Delete(':projectId/assignments/:id')
  removeAssignment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.projects.removeAssignment(projectId, id);
  }
}
