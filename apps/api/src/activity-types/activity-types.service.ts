/**
 * Service: Katalog der Master-Tätigkeitsbereiche.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';

const select = {
  id: true,
  code: true,
  name: true,
  sortOrder: true,
  active: true,
  billable: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ActivityTypeSelect;

@Injectable()
export class ActivityTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(active?: boolean) {
    return this.prisma.activityType.findMany({
      where: active === undefined ? undefined : { active },
      select,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.activityType.findUnique({
      where: { id },
      select,
    });
    if (!row) throw new NotFoundException('Tätigkeitsbereich nicht gefunden');
    return row;
  }

  async create(dto: CreateActivityTypeDto) {
    const code = dto.code.trim().toUpperCase();
    try {
      return await this.prisma.activityType.create({
        data: {
          code,
          name: dto.name.trim(),
          sortOrder: dto.sortOrder ?? 100,
          active: dto.active ?? true,
          billable: dto.billable ?? true,
        },
        select,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Code bereits vergeben');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateActivityTypeDto) {
    await this.findOne(id);
    try {
      return await this.prisma.activityType.update({
        where: { id },
        data: {
          ...(dto.code != null ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.active != null ? { active: dto.active } : {}),
          ...(dto.billable != null ? { billable: dto.billable } : {}),
        },
        select,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Code bereits vergeben');
      }
      throw err;
    }
  }

  /** Soft-Delete: deaktivieren (Segmente bleiben referenzierbar). */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.activityType.update({
      where: { id },
      data: { active: false },
      select,
    });
  }
}
