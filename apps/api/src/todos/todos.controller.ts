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
import { RolesGuard } from '../auth/guards/roles.guard';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { UpdateTodoStatusDto } from './dto/update-todo-status.dto';

@ApiTags('todos')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE, RoleCode.PROJECT_MANAGER)
@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

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

  @Get('my')
  @ApiOperation({ summary: 'Meine Aufgaben' })
  getMyTodos(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: TodoStatus,
  ) {
    return this.todos.getMyTodos(user.id, status);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard-Daten (offene/überfällige Counts + nächste fällige)' })
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.todos.getDashboardData(user.id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Aktive Benutzer für Zuweisungs-Dropdown' })
  getUsers() {
    return this.todos.listUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Aufgabe laden' })
  findOne(@Param('id') id: string) {
    return this.todos.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Aufgabe erstellen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTodoDto) {
    return this.todos.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aufgabe aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.todos.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Aufgaben-Status ändern (schnelles Abhaken)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTodoStatusDto) {
    return this.todos.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aufgabe löschen' })
  remove(@Param('id') id: string) {
    return this.todos.remove(id);
  }
}
