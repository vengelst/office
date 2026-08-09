/**
 * HTTP-API für Todos.
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
import { RoleCode, TodoEntityType, TodoPriority, TodoStatus } from '@prisma/client';
import { AuthUser } from '@office/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../feature-flags/require-feature.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { UpdateTodoStatusDto } from './dto/update-todo-status.dto';

@ApiTags('todos')
@ApiBearerAuth()
@UseGuards(RolesGuard, FeatureFlagGuard)
@RequireFeature('todos')
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  /**
   * Liefert eine (ggf. gefilterte/paginierte) Liste.
   *
   * @param status - Zielstatus (TodoStatus)
   * @param priority - Parameter `priority` (TodoPriority)
   * @param assignedToId - ID (assignedToId) (string)
   * @param linkedEntityType - Parameter `linkedEntityType` (TodoEntityType)
   * @param linkedEntityId - ID (linkedEntityId) (string)
   * @param overdue - Parameter `overdue` (string)
   * @param page - Seitennummer (1-basiert) (string)
   * @param limit - Seitengröße (string)
   * @returns Listenergebnis
   */

  @Get()
  @ApiOperation({ summary: 'Alle Aufgaben auflisten (Filter)' })
  findAll(
    @Query('status') status?: TodoStatus,
    @Query('priority') priority?: TodoPriority,
    @Query('assignedToId') assignedToId?: string,
    @Query('linkedEntityType') linkedEntityType?: TodoEntityType,
    @Query('linkedEntityId') linkedEntityId?: string,
    @Query('overdue') overdue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.todos.list({
      status,
      priority,
      assignedToId,
      linkedEntityType,
      linkedEntityId,
      overdue: overdue === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Liefert Todos des aktuellen Benutzers.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @param status - Zielstatus (TodoStatus)
   * @returns Todo-Liste
   */

  @Get('my')
  @ApiOperation({ summary: 'Meine Aufgaben' })
  getMyTodos(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: TodoStatus,
  ) {
    return this.todos.getMyTodos(user.id, status);
  }

  /**
   * Liefert Todo-Daten für das Dashboard.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @returns Dashboard-Daten
   */

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard-Daten (offene/überfällige Counts + nächste fällige)' })
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.todos.getDashboardData(user.id);
  }

  /**
   * Listet Benutzer (z. B. für Todo-Zuweisung).
   *
   * @returns Benutzer-Liste
   */

  @Get('users')
  @ApiOperation({ summary: 'Aktive Benutzer für Zuweisungs-Dropdown' })
  getUsers() {
    return this.todos.listUsers();
  }

  /**
   * Lädt einen einzelnen Datensatz anhand der ID.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Datensatz
   */

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Aufgabe laden' })
  findOne(@Param('id') id: string) {
    return this.todos.get(id);
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param user - Authentifizierter Akteur aus dem Request-Kontext (AuthUser)
   * @param dto - Request-Body / Eingabedaten (CreateTodoDto)
   * @returns Neu angelegter Datensatz
   */

  @Post()
  @ApiOperation({ summary: 'Aufgabe erstellen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTodoDto) {
    return this.todos.create(dto, user.id);
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateTodoDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id')
  @ApiOperation({ summary: 'Aufgabe aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.todos.update(id, dto);
  }

  /**
   * Aktualisiert nur den Status.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateTodoStatusDto)
   * @returns Aktualisierter Datensatz
   */

  @Patch(':id/status')
  @ApiOperation({ summary: 'Aufgaben-Status ändern (schnelles Abhaken)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTodoStatusDto) {
    return this.todos.updateStatus(id, dto.status);
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
    return this.todos.bulkRemove(dto.ids);
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */

  @Delete(':id')
  @ApiOperation({ summary: 'Aufgabe löschen' })
  remove(@Param('id') id: string) {
    return this.todos.remove(id);
  }
}
