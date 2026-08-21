/**
 * Service für Office-Termine inkl. Sync Office → Google Calendar.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../google-drive/google-calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

export interface ListCalendarEventsParams {
  from?: string;
  to?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CalendarEventsService {
  private readonly logger = new Logger(CalendarEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  /**
   * Gefilterte, paginierte Terminliste (nach Zeitraum / Projekt).
   */
  async list(params: ListCalendarEventsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.CalendarEventWhereInput = {};

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    if (params.from || params.to) {
      where.AND = [];
      if (params.from) {
        where.AND.push({ endAt: { gte: new Date(params.from) } });
      }
      if (params.to) {
        where.AND.push({ startAt: { lte: new Date(params.to) } });
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.calendarEvent.findMany({
        where,
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
        include: {
          project: {
            select: { id: true, projectNumber: true, title: true },
          },
        },
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, projectNumber: true, title: true },
        },
      },
    });
    if (!event) {
      throw new NotFoundException('Termin nicht gefunden');
    }
    return event;
  }

  async create(dto: CreateCalendarEventDto, createdById?: string) {
    this.assertRange(dto.startAt, dto.endAt);
    if (dto.projectId) {
      await this.ensureProject(dto.projectId);
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        allDay: dto.allDay ?? false,
        projectId: dto.projectId,
        syncToGoogle: dto.syncToGoogle ?? true,
        createdById,
      },
      include: {
        project: {
          select: { id: true, projectNumber: true, title: true },
        },
      },
    });

    if (event.syncToGoogle) {
      this.syncToGoogle(event.id)
        .catch((err) =>
          this.logger.warn(
            `Google Calendar Sync fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    }

    return event;
  }

  async update(id: string, dto: UpdateCalendarEventDto) {
    const existing = await this.get(id);

    const startAt = dto.startAt ?? existing.startAt.toISOString();
    const endAt = dto.endAt ?? existing.endAt.toISOString();
    this.assertRange(startAt, endAt);

    if (dto.projectId) {
      await this.ensureProject(dto.projectId);
    }

    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        allDay: dto.allDay,
        projectId: dto.projectId === undefined ? undefined : dto.projectId || null,
        syncToGoogle: dto.syncToGoogle,
      },
      include: {
        project: {
          select: { id: true, projectNumber: true, title: true },
        },
      },
    });

    const wasSyncing = existing.syncToGoogle;
    const nowSyncing = dto.syncToGoogle ?? wasSyncing;

    if (!wasSyncing && nowSyncing) {
      this.syncToGoogle(event.id)
        .catch((err) =>
          this.logger.warn(
            `Google Calendar Sync fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    } else if (wasSyncing && !nowSyncing && existing.googleEventId) {
      this.googleCalendar
        .deleteEvent(existing.googleEventId)
        .then(() =>
          this.prisma.calendarEvent.update({
            where: { id },
            data: { googleEventId: null },
          }),
        )
        .catch((err) =>
          this.logger.warn(
            `Google Termin löschen fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    } else if (nowSyncing) {
      this.syncToGoogle(event.id)
        .catch((err) =>
          this.logger.warn(
            `Google Calendar Sync fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    }

    return event;
  }

  async remove(id: string) {
    const event = await this.get(id);
    await this.prisma.calendarEvent.delete({ where: { id } });

    if (event.syncToGoogle && event.googleEventId) {
      this.googleCalendar
        .deleteEvent(event.googleEventId)
        .catch((err) =>
          this.logger.warn(
            `Google Termin löschen fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    }

    return { id, deleted: true };
  }

  /** Sync eines DB-Termins nach Google (create oder update). */
  private async syncToGoogle(eventId: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
    if (!event || !event.syncToGoogle) return;

    const data = {
      title: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
    };

    if (event.googleEventId) {
      await this.googleCalendar.updateEvent(event.googleEventId, data);
    } else {
      const googleEventId = await this.googleCalendar.createEvent(data);
      if (googleEventId) {
        await this.prisma.calendarEvent.update({
          where: { id: eventId },
          data: { googleEventId },
        });
      }
    }
  }

  private assertRange(startAt: string | Date, endAt: string | Date): void {
    const start = startAt instanceof Date ? startAt : new Date(startAt);
    const end = endAt instanceof Date ? endAt : new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Ungültiges Start- oder Enddatum');
    }
    if (end < start) {
      throw new BadRequestException('Ende muss nach dem Start liegen');
    }
  }

  private async ensureProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
  }
}
