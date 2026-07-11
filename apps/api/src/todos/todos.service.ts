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

  async get(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException('Aufgabe nicht gefunden');
    }
    return todo;
  }

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

  async remove(id: string) {
    await this.get(id);
    await this.prisma.todo.delete({ where: { id } });
    return { id, deleted: true };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}
