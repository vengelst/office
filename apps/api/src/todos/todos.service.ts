/**
 * Service für Aufgaben (Todos): Listen, Dashboard-Aggregation und Statuswechsel.
 * Todos können an Kunden, Projekte und andere Entitäten gekoppelt werden.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  TodoEntityType,
  TodoPriority,
  TodoStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

export interface ListTodosParams {
  status?: TodoStatus;
  priority?: TodoPriority;
  assignedToId?: string;
  linkedEntityType?: TodoEntityType;
  linkedEntityId?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface DashboardData {
  openCount: number;
  overdueCount: number;
  upcoming: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    status: string;
    linkedEntityName: string | null;
  }>;
}

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert eine gefilterte, paginierte Todo-Liste.
   *
   * @param params - Filter-, Sortier- und/oder Pagination-Parameter (ListTodosParams)
   * @returns Liste
   */
  async list(params: ListTodosParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.TodoWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }
    if (params.priority) {
      where.priority = params.priority;
    }
    if (params.assignedToId) {
      where.assignedToId = params.assignedToId;
    }
    if (params.linkedEntityType) {
      where.linkedEntityType = params.linkedEntityType;
    }
    if (params.linkedEntityId) {
      where.linkedEntityId = params.linkedEntityId;
    }
    if (params.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.todo.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.todo.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Liefert Todos des aktuellen Benutzers.
   *
   * @param userId - ID (userId) (string)
   * @param status - Zielstatus (TodoStatus)
   * @returns Todo-Liste
   */
  async getMyTodos(userId: string, status?: TodoStatus) {
    const where: Prisma.TodoWhereInput = { assignedToId: userId };
    if (status) {
      where.status = status;
    }
    return this.prisma.todo.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Aggregiert Todo-Kennzahlen für das Dashboard.
   *
   * @param userId - ID (userId) (string)
   * @returns Dashboard-Daten (DashboardData)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    const now = new Date();

    const [openCount, overdueCount, upcoming] = await this.prisma.$transaction([
      this.prisma.todo.count({
        where: {
          assignedToId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.todo.count({
        where: {
          assignedToId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
      }),
      this.prisma.todo.findMany({
        where: {
          assignedToId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          priority: true,
          dueDate: true,
          status: true,
          linkedEntityName: true,
        },
      }),
    ]);

    return {
      openCount,
      overdueCount,
      upcoming: upcoming.map((t) => ({
        ...t,
        dueDate: t.dueDate?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Liest einen Konfigurations- oder Datensatzwert.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Gelesener Wert
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async get(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException('Aufgabe nicht gefunden');
    }
    return todo;
  }

  /**
   * Legt einen neuen Datensatz an.
   *
   * @param dto - Request-Body / Eingabedaten (CreateTodoDto)
   * @param createdById - ID (createdById) (string)
   * @returns Neu angelegter Datensatz
   */
  async create(dto: CreateTodoDto, createdById?: string) {
    return this.prisma.todo.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId: dto.assignedToId,
        createdById,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        linkedEntityName: dto.linkedEntityName,
      },
    });
  }

  /**
   * Aktualisiert einen bestehenden Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param dto - Request-Body / Eingabedaten (UpdateTodoDto)
   * @returns Aktualisierter Datensatz
   */
  async update(id: string, dto: UpdateTodoDto) {
    await this.get(id);

    const data: Prisma.TodoUpdateInput = { ...dto };
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.status === 'DONE') {
      data.completedAt = new Date();
    } else if (dto.status) {
      data.completedAt = null;
    }

    return this.prisma.todo.update({ where: { id }, data });
  }

  /**
   * Aktualisiert nur den Status.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @param status - Zielstatus (TodoStatus)
   * @returns Aktualisierter Datensatz
   */
  async updateStatus(id: string, status: TodoStatus) {
    await this.get(id);

    const data: Prisma.TodoUpdateInput = { status };
    if (status === 'DONE') {
      data.completedAt = new Date();
    } else {
      data.completedAt = null;
    }

    return this.prisma.todo.update({ where: { id }, data });
  }

  /**
   * Löscht bzw. deaktiviert einen Datensatz.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns Ergebnis der Löschung
   */
  async remove(id: string) {
    await this.get(id);
    await this.prisma.todo.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Mehrfach-Löschen: ruft remove() je ID auf.
   *
   * @param ids - Liste von IDs (string[])
   * @returns Ergebnis der Massenlöschung
   */
  async bulkRemove(ids: string[]) {
    const results = [];
    const errors = [];
    for (const id of ids) {
      try {
        results.push(await this.remove(id));
      } catch (err) {
        errors.push({
          id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { deleted: results.length, failed: errors.length, results, errors };
  }

  /**
   * Listet Benutzer für Auswahlfelder.
   *
   * @returns Benutzer-Liste
   */
  async listUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}
