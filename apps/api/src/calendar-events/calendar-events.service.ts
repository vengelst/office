/**
 * Service für Office-Termine (CalendarEvent) inkl. Sync Office → Google.
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

const includeRelations = {
  project: { select: { id: true, projectNumber: true, title: true } },
  customer: { select: { id: true, customerNumber: true, companyName: true } },
  createdBy: { select: { id: true, displayName: true, email: true } },
} as const;

export interface ListCalendarEventsParams {
  from?: string;
  to?: string;
  projectId?: string;
  customerId?: string;
}

@Injectable()
export class CalendarEventsService {
  private readonly logger = new Logger(CalendarEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  async list(params: ListCalendarEventsParams) {
    const where: Prisma.CalendarEventWhereInput = {};

    if (params.from || params.to) {
      where.startsAt = {};
      if (params.from) where.startsAt.gte = new Date(params.from);
      if (params.to) where.startsAt.lte = new Date(params.to);
    }
    if (params.projectId) where.projectId = params.projectId;
    if (params.customerId) where.customerId = params.customerId;

    return this.prisma.calendarEvent.findMany({
      where,
      include: includeRelations,
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!event) throw new NotFoundException('Termin nicht gefunden');
    return event;
  }

  async create(dto: CreateCalendarEventDto, createdById?: string) {
    this.assertRange(dto.startsAt, dto.endsAt);
    await this.assertRefs(dto.projectId, dto.customerId);

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        allDay: dto.allDay ?? false,
        projectId: dto.projectId || null,
        customerId: dto.customerId || null,
        createdById: createdById || null,
        syncToGoogle: dto.syncToGoogle ?? true,
      },
      include: includeRelations,
    });

    if (event.syncToGoogle) {
      this.syncEventToGoogle(event.id, event)
        .catch((err) =>
          this.logger.warn(
            `Google Calendar Sync fehlgeschlagen: ${(err as Error).message}`,
          ),
        );
    }

    return event;
  }

  async update(id: string, dto: UpdateCalendarEventDto) {
    const existing = await this.prisma.calendarEvent.findUnique({
      where: { id },
      select: {
        syncToGoogle: true,
        googleEventId: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Termin nicht gefunden');

    if (dto.startsAt || dto.endsAt) {
      this.assertRange(
        dto.startsAt ?? existing.startsAt.toISOString(),
        dto.endsAt ?? existing.endsAt.toISOString(),
      );
    }
    await this.assertRefs(dto.projectId, dto.customerId);

    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: new Date(dto.startsAt) }
          : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
        ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
        ...(dto.projectId !== undefined
          ? { projectId: dto.projectId || null }
          : {}),
        ...(dto.customerId !== undefined
          ? { customerId: dto.customerId || null }
          : {}),
        ...(dto.syncToGoogle !== undefined
          ? { syncToGoogle: dto.syncToGoogle }
          : {}),
      },
      include: includeRelations,
    });

    const wasSyncing = existing.syncToGoogle;
    const nowSyncing = dto.syncToGoogle ?? wasSyncing;

    if (!wasSyncing && nowSyncing && !existing.googleEventId) {
      this.syncEventToGoogle(event.id, event).catch((err) =>
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
      this.syncEventToGoogle(event.id, event).catch((err) =>
        this.logger.warn(
          `Google Calendar Sync fehlgeschlagen: ${(err as Error).message}`,
        ),
      );
    }

    return event;
  }

  async remove(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      select: { googleEventId: true, syncToGoogle: true },
    });
    if (!event) throw new NotFoundException('Termin nicht gefunden');

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

    return { deleted: true, id };
  }

  private assertRange(startsAt: string, endsAt: string): void {
    if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      throw new BadRequestException('Ende muss nach dem Start liegen');
    }
  }

  private async assertRefs(
    projectId?: string | null,
    customerId?: string | null,
  ): Promise<void> {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw new BadRequestException('Projekt nicht gefunden');
    }
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Kunde nicht gefunden');
    }
  }

  private async syncEventToGoogle(
    eventId: string,
    event: {
      title: string;
      description?: string | null;
      startsAt: Date;
      endsAt: Date;
      allDay: boolean;
      googleEventId?: string | null;
    },
  ): Promise<void> {
    const data = {
      title: event.title,
      description: event.description ?? undefined,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
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
}
