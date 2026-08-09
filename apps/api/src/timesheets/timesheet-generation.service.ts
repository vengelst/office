/**
 * Generierung und Tageskorrektur von Wochenstundenzetteln.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreakScopeType,
  TimeEntryType,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import {
  computeBreakMinutes,
  dayKey,
  diffMinutes,
  isoWeekRange,
  selectBreakRule,
} from './timesheet.util';
import {
  EDITABLE_STATUSES,
  detailInclude,
  type DayAggregate,
  sumTotals,
  parseDate,
} from './timesheet-shared';

@Injectable()
export class TimesheetGenerationService {
  constructor(private readonly prisma: PrismaService) {}


  private async findOne(id: string) {
    const timesheet = await this.prisma.weeklyTimesheet.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!timesheet) {
      throw new NotFoundException('Stundenzettel nicht gefunden');
    }
    return timesheet;
  }

  // ── Generieren aus TimeEntries ───────────────────────────────

  /**
   * Generiert einen Wochenstundenzettel aus den Stempel-Einträgen (TimeEntries).
   * Aggregiert Tageweise Brutto-Zeiten und berechnet Pausen anhand der Pausenregeln.
   * Bei bereits existierendem Zettel (DRAFT/REJECTED) wird er überschrieben.
   *
   * @param dto - Monteur-ID, Projekt-ID, Kalenderwoche
   * @returns Der generierte Stundenzettel mit allen Tageseinträgen
   * @throws ConflictException bei bereits eingereichten/genehmigten Zetteln
   */
  async generate(dto: GenerateTimesheetDto) {
    await this.assertWorker(dto.workerId);
    await this.assertProject(dto.projectId);

    const existing = await this.prisma.weeklyTimesheet.findUnique({
      where: {
        workerId_projectId_weekYear_weekNumber: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          weekYear: dto.weekYear,
          weekNumber: dto.weekNumber,
        },
      },
      select: { id: true, status: true },
    });
    if (existing && !EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        'Stundenzettel ist bereits eingereicht/freigegeben und kann nicht neu generiert werden',
      );
    }

    const { start, end } = isoWeekRange(dto.weekYear, dto.weekNumber);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        workerId: dto.workerId,
        projectId: dto.projectId,
        entryType: { in: [TimeEntryType.CLOCK_IN, TimeEntryType.CLOCK_OUT] },
        occurredAtClient: { gte: start, lte: end },
      },
      orderBy: { occurredAtClient: 'asc' },
    });

    const rule = selectBreakRule(
      await this.prisma.breakRule.findMany({
        where: {
          active: true,
          OR: [
            { scopeType: BreakScopeType.GLOBAL },
            { scopeType: BreakScopeType.PROJECT, projectId: dto.projectId },
          ],
        },
      }),
      dto.projectId,
    );

    const aggregates = this.aggregateDays(entries);

    const days = aggregates.map((a) => {
      const breakMinutes = computeBreakMinutes(a.grossMinutes, rule);
      return {
        workDate: a.workDate,
        firstClockInAt: a.firstClockInAt,
        lastClockOutAt: a.lastClockOutAt,
        grossMinutes: a.grossMinutes,
        breakMinutes,
        netMinutes: Math.max(0, a.grossMinutes - breakMinutes),
        clockInLatitude: a.clockInLatitude,
        clockInLongitude: a.clockInLongitude,
        clockOutLatitude: a.clockOutLatitude,
        clockOutLongitude: a.clockOutLongitude,
      };
    });

    const totals = sumTotals(days);

    const timesheet = await this.prisma.$transaction(async (tx) => {
      const sheet = await tx.weeklyTimesheet.upsert({
        where: {
          workerId_projectId_weekYear_weekNumber: {
            workerId: dto.workerId,
            projectId: dto.projectId,
            weekYear: dto.weekYear,
            weekNumber: dto.weekNumber,
          },
        },
        create: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          weekYear: dto.weekYear,
          weekNumber: dto.weekNumber,
          status: WeeklyTimesheetStatus.DRAFT,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.break,
          totalMinutesNet: totals.net,
        },
        update: {
          status: WeeklyTimesheetStatus.DRAFT,
          generatedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.break,
          totalMinutesNet: totals.net,
        },
        select: { id: true },
      });

      await tx.weeklyTimesheetDay.deleteMany({
        where: { weeklyTimesheetId: sheet.id },
      });
      if (days.length) {
        await tx.weeklyTimesheetDay.createMany({
          data: days.map((d) => ({ ...d, weeklyTimesheetId: sheet.id })),
        });
      }
      return sheet;
    });

    return this.findOne(timesheet.id);
  }

  // ── Tageskorrektur ───────────────────────────────────────────

  /**
   * Korrigiert einen Tageseintrag manuell (z.B. fehlende Zeiten nachtragen).
   * Berechnet Brutto/Netto/Pause neu und aktualisiert die Wochensummen.
   *
   * @param id - UUID des Stundenzettels
   * @param dayId - UUID des Tageseintrags
   * @param dto - Korrigierte Zeitwerte
   * @returns Der aktualisierte Stundenzettel
   */
  async updateDay(id: string, dayId: string, dto: UpdateDayDto) {
    const sheet = await this.ensureEditable(id);
    const day = sheet.days.find((d) => d.id === dayId);
    if (!day) {
      throw new NotFoundException('Tageseintrag nicht gefunden');
    }

    const firstClockInAt =
      dto.firstClockInAt !== undefined
        ? parseDate(dto.firstClockInAt)
        : day.firstClockInAt;
    const lastClockOutAt =
      dto.lastClockOutAt !== undefined
        ? parseDate(dto.lastClockOutAt)
        : day.lastClockOutAt;

    let grossMinutes = day.grossMinutes ?? 0;
    if (firstClockInAt && lastClockOutAt) {
      grossMinutes = diffMinutes(firstClockInAt, lastClockOutAt);
    }

    const rule = selectBreakRule(
      await this.prisma.breakRule.findMany({
        where: {
          active: true,
          OR: [
            { scopeType: BreakScopeType.GLOBAL },
            { scopeType: BreakScopeType.PROJECT, projectId: sheet.projectId },
          ],
        },
      }),
      sheet.projectId,
    );
    const breakMinutes =
      dto.breakMinutes !== undefined
        ? dto.breakMinutes
        : computeBreakMinutes(grossMinutes, rule);

    await this.prisma.weeklyTimesheetDay.update({
      where: { id: dayId },
      data: {
        firstClockInAt,
        lastClockOutAt,
        grossMinutes,
        breakMinutes,
        netMinutes: Math.max(0, grossMinutes - breakMinutes),
        summaryComment:
          dto.summaryComment !== undefined
            ? dto.summaryComment
            : day.summaryComment,
      },
    });

    await this.recomputeTotals(id);
    return this.findOne(id);
  }

  /**
   * Aggregiert Stempel-Einträge tageweise zu Brutto-Zeiten.
   *
   * @returns Tagesaggregation
   */
  private aggregateDays(
    entries: Array<{
      entryType: TimeEntryType;
      occurredAtClient: Date;
      latitude: number | null;
      longitude: number | null;
    }>,
  ): DayAggregate[] {
    const byDay = new Map<string, DayAggregate>();

    const openIn = new Map<
      string,
      { at: Date; lat: number | null; lng: number | null }
    >();

    for (const e of entries) {
      const key = dayKey(e.occurredAtClient);
      let agg = byDay.get(key);
      if (!agg) {
        const workDate = new Date(e.occurredAtClient);
        workDate.setHours(0, 0, 0, 0);
        agg = {
          workDate,
          firstClockInAt: null,
          lastClockOutAt: null,
          grossMinutes: 0,
          clockInLatitude: null,
          clockInLongitude: null,
          clockOutLatitude: null,
          clockOutLongitude: null,
        };
        byDay.set(key, agg);
      }

      if (e.entryType === TimeEntryType.CLOCK_IN) {
        if (!agg.firstClockInAt) {
          agg.firstClockInAt = e.occurredAtClient;
          agg.clockInLatitude = e.latitude;
          agg.clockInLongitude = e.longitude;
        }
        openIn.set(key, {
          at: e.occurredAtClient,
          lat: e.latitude,
          lng: e.longitude,
        });
      } else if (e.entryType === TimeEntryType.CLOCK_OUT) {
        const open = openIn.get(key);
        if (open) {
          agg.grossMinutes += diffMinutes(open.at, e.occurredAtClient);
          openIn.delete(key);
        }
        agg.lastClockOutAt = e.occurredAtClient;
        agg.clockOutLatitude = e.latitude;
        agg.clockOutLongitude = e.longitude;
      }
    }

    return [...byDay.values()].sort(
      (a, b) => a.workDate.getTime() - b.workDate.getTime(),
    );
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `recomputeTotals` (recompute Totals).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  private async recomputeTotals(id: string): Promise<void> {
    const days = await this.prisma.weeklyTimesheetDay.findMany({
      where: { weeklyTimesheetId: id },
      select: { grossMinutes: true, breakMinutes: true, netMinutes: true },
    });
    const totals = sumTotals(days);
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        totalMinutesGross: totals.gross,
        totalBreakMinutes: totals.break,
        totalMinutesNet: totals.net,
      },
    });
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureEditable` (ensure Editable).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  private async ensureEditable(id: string) {
    const sheet = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Stundenzettel kann in diesem Status nicht bearbeitet werden',
      );
    }
    return sheet;
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `assertWorker` (assert Worker).
   *
   * @param workerId - ID des Monteurs (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async assertWorker(workerId: string): Promise<void> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `assertProject` (assert Project).
   *
   * @param projectId - ID des Projekts (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
  }
}

