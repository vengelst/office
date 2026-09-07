/**
 * Generierung und Tageskorrektur von Wochenstundenzetteln.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
import { UpsertDayDto } from './dto/upsert-day.dto';
import {
  computeBreakMinutes,
  dayKey,
  diffMinutes,
  isoWeekOf,
  isoWeekRange,
  selectBreakRule,
} from './timesheet.util';
import {
  berlinDateKey,
  berlinDayRange,
  effectiveBreakMinutes,
  type StempelEvent,
} from '../time-entries/break-calc.util';
import {
  EDITABLE_STATUSES,
  detailInclude,
  type DayAggregate,
  sumTotals,
  parseDate,
} from './timesheet-shared';
import { validateWorkDocumentation } from '../time-entries/work-documentation.util';

@Injectable()
export class TimesheetGenerationService {
  private readonly logger = new Logger(TimesheetGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stellt sicher, dass für Monteur+Projekt+ISO-KW (Mo–So, Europe/Berlin)
   * ein editierbarer Stundenzettel existiert und aus Stempelungen aktuell ist.
   * Gesperrte/freigegebene Sheets bleiben unberührt. Fehler werden geloggt,
   * nicht geworfen – Stempelvorgänge dürfen deshalb nicht scheitern.
   */
  async ensureForStamp(params: {
    workerId: string;
    projectId: string;
    at: Date;
  }): Promise<void> {
    try {
      const dateKey = berlinDateKey(params.at);
      const day = berlinDayRange(dateKey).from;
      const { weekYear, weekNumber } = isoWeekOf(day);
      await this.generateOneWeek({
        workerId: params.workerId,
        projectId: params.projectId,
        weekYear,
        weekNumber,
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        this.logger.warn(
          `Stundenzettel auto-sync übersprungen (gesperrt): worker=${params.workerId} project=${params.projectId}`,
        );
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Stundenzettel auto-sync fehlgeschlagen: worker=${params.workerId} project=${params.projectId}: ${msg}`,
      );
    }
  }


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
   * Generiert einen oder mehrere Wochenstundenzettel aus Stempelungen.
   * Leere Tage der KW werden immer angelegt (manuelle Bearbeitung ohne Handy).
   * Optional `weekNumberTo` = mehrere KW in einem Lauf.
   */
  async generate(dto: GenerateTimesheetDto) {
    const from = dto.weekNumber;
    const to = dto.weekNumberTo ?? dto.weekNumber;
    if (to < from) {
      throw new BadRequestException(
        'weekNumberTo muss größer oder gleich weekNumber sein',
      );
    }

    const sheets = [];
    for (let weekNumber = from; weekNumber <= to; weekNumber++) {
      sheets.push(
        await this.generateOneWeek({
          workerId: dto.workerId,
          projectId: dto.projectId,
          weekYear: dto.weekYear,
          weekNumber,
        }),
      );
    }

    if (to === from) {
      return sheets[0];
    }
    return { sheets, count: sheets.length };
  }

  /**
   * Eine Kalenderwoche: Upsert DRAFT, 7 Tageszeilen (Stempel + leere Tage).
   */
  async generateOneWeek(dto: {
    workerId: string;
    projectId: string;
    weekYear: number;
    weekNumber: number;
  }) {
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
        `Stundenzettel KW ${dto.weekNumber}/${dto.weekYear} ist bereits eingereicht/freigegeben und kann nicht neu generiert werden`,
      );
    }

    const { start, end } = isoWeekRange(dto.weekYear, dto.weekNumber);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        workerId: dto.workerId,
        projectId: dto.projectId,
        entryType: {
          in: [
            TimeEntryType.CLOCK_IN,
            TimeEntryType.CLOCK_OUT,
            TimeEntryType.BREAK_START,
            TimeEntryType.BREAK_END,
          ],
        },
        occurredAtClient: { gte: start, lte: end },
      },
      orderBy: { occurredAtClient: 'asc' },
      include: {
        workActivities: {
          select: { projectWorkActivityId: true },
        },
      },
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
    const byKey = new Map(
      aggregates.map((a) => [dayKey(a.workDate), a] as const),
    );

    const days: Array<{
      workDate: Date;
      firstClockInAt: Date | null;
      lastClockOutAt: Date | null;
      grossMinutes: number;
      breakMinutes: number;
      netMinutes: number;
      clockInLatitude: number | null;
      clockInLongitude: number | null;
      clockOutLatitude: number | null;
      clockOutLongitude: number | null;
    }> = [];
    for (let i = 0; i < 7; i++) {
      const workDate = new Date(start);
      workDate.setUTCDate(start.getUTCDate() + i);
      workDate.setUTCHours(0, 0, 0, 0);
      // Lokaler Kalendertag (API-TZ Europe/Berlin) für dayKey-Abgleich mit Stempelungen
      const localMidnight = new Date(
        workDate.getUTCFullYear(),
        workDate.getUTCMonth(),
        workDate.getUTCDate(),
      );
      const key = dayKey(localMidnight);
      const a = byKey.get(key);
      if (a) {
        const dayEvents: StempelEvent[] = entries
          .filter((e) => dayKey(e.occurredAtClient) === key)
          .map((e) => ({
            entryType: e.entryType,
            occurredAtClient: e.occurredAtClient,
            projectId: e.projectId,
          }));
        const breakMinutes = effectiveBreakMinutes(
          dayEvents,
          a.grossMinutes,
          rule,
        ).effective;
        days.push({
          workDate: localMidnight,
          firstClockInAt: a.firstClockInAt,
          lastClockOutAt: a.lastClockOutAt,
          grossMinutes: a.grossMinutes,
          breakMinutes,
          netMinutes: Math.max(0, a.grossMinutes - breakMinutes),
          clockInLatitude: a.clockInLatitude,
          clockInLongitude: a.clockInLongitude,
          clockOutLatitude: a.clockOutLatitude,
          clockOutLongitude: a.clockOutLongitude,
        });
      } else {
        days.push({
          workDate: localMidnight,
          firstClockInAt: null,
          lastClockOutAt: null,
          grossMinutes: 0,
          breakMinutes: 0,
          netMinutes: 0,
          clockInLatitude: null,
          clockInLongitude: null,
          clockOutLatitude: null,
          clockOutLongitude: null,
        });
      }
    }

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

      const weekSegments = await tx.timeActivitySegment.findMany({
        where: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          startedAt: { lte: end },
          OR: [{ endedAt: null }, { endedAt: { gte: start } }],
        },
        select: {
          activityTypeId: true,
          startedAt: true,
          endedAt: true,
        },
      });

      for (const d of days) {
        const dayRow = await tx.weeklyTimesheetDay.create({
          data: { ...d, weeklyTimesheetId: sheet.id },
        });
        const dayStart = new Date(d.workDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d.workDate);
        dayEnd.setHours(23, 59, 59, 999);

        const byType = new Map<string, number>();
        for (const seg of weekSegments) {
          const segStart = seg.startedAt < dayStart ? dayStart : seg.startedAt;
          const segEndRaw = seg.endedAt ?? new Date();
          const segEnd = segEndRaw > dayEnd ? dayEnd : segEndRaw;
          if (segEnd <= segStart) continue;
          if (seg.startedAt > dayEnd || (seg.endedAt && seg.endedAt < dayStart)) {
            continue;
          }
          const mins = Math.max(
            0,
            Math.round((segEnd.getTime() - segStart.getTime()) / 60000),
          );
          if (mins <= 0) continue;
          byType.set(
            seg.activityTypeId,
            (byType.get(seg.activityTypeId) ?? 0) + mins,
          );
        }
        if (byType.size > 0) {
          await tx.weeklyTimesheetDayActivity.createMany({
            data: [...byType.entries()].map(([activityTypeId, minutes]) => ({
              weeklyTimesheetDayId: dayRow.id,
              activityTypeId,
              minutes,
            })),
          });
        }

        // Projekt-Arbeiten aus dokumentierten CLOCK_OUT aggregieren (Auftrag #30)
        const dayOuts = entries.filter(
          (e) =>
            e.entryType === TimeEntryType.CLOCK_OUT &&
            e.workDocumentedAt != null &&
            dayKey(e.occurredAtClient) === dayKey(d.workDate),
        );
        const workIdSet = new Set<string>();
        const noteParts: string[] = [];
        for (const out of dayOuts) {
          for (const link of out.workActivities) {
            workIdSet.add(link.projectWorkActivityId);
          }
          const n = out.workNotes?.trim();
          if (n) noteParts.push(n);
        }
        if (workIdSet.size > 0) {
          await tx.weeklyTimesheetDayWorkActivity.createMany({
            data: [...workIdSet].map((projectWorkActivityId) => ({
              dayId: dayRow.id,
              projectWorkActivityId,
            })),
          });
        }
        if (noteParts.length > 0) {
          await tx.weeklyTimesheetDay.update({
            where: { id: dayRow.id },
            data: { workNotes: noteParts.join(' · ') },
          });
        }
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

    if (
      dto.projectWorkActivityIds !== undefined ||
      dto.workNotes !== undefined
    ) {
      await this.applyDayWorkDocumentation(sheet.projectId, dayId, {
        projectWorkActivityIds: dto.projectWorkActivityIds,
        workNotes: dto.workNotes,
        existingActivityIds: (day as { workActivities?: Array<{ projectWorkActivityId: string }> })
          .workActivities?.map((w) => w.projectWorkActivityId),
        existingNotes: (day as { workNotes?: string | null }).workNotes,
      });
    }

    await this.recomputeTotals(id);
    return this.findOne(id);
  }

  /**
   * Legt einen Tag an oder überschreibt ihn (manuelle Erfassung ohne Stempel/Handy).
   */
  async upsertDay(id: string, dto: UpsertDayDto) {
    const sheet = await this.ensureEditable(id);
    const workDate = parseDate(dto.workDate);
    workDate.setHours(0, 0, 0, 0);

    const { start, end } = isoWeekRange(sheet.weekYear, sheet.weekNumber);
    const startLocal = new Date(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    );
    const endLocal = new Date(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    );
    endLocal.setHours(23, 59, 59, 999);
    if (workDate < startLocal || workDate > endLocal) {
      throw new BadRequestException(
        `Datum liegt nicht in KW ${sheet.weekNumber}/${sheet.weekYear}`,
      );
    }

    const firstClockInAt =
      dto.firstClockInAt !== undefined
        ? parseDate(dto.firstClockInAt)
        : null;
    const lastClockOutAt =
      dto.lastClockOutAt !== undefined
        ? parseDate(dto.lastClockOutAt)
        : null;

    let grossMinutes = 0;
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

    const existing = sheet.days.find(
      (d) => dayKey(d.workDate) === dayKey(workDate),
    );

    const data = {
      workDate,
      firstClockInAt,
      lastClockOutAt,
      grossMinutes,
      breakMinutes,
      netMinutes: Math.max(0, grossMinutes - breakMinutes),
      summaryComment: dto.summaryComment ?? existing?.summaryComment ?? null,
    };

    if (existing) {
      await this.prisma.weeklyTimesheetDay.update({
        where: { id: existing.id },
        data,
      });
      if (
        dto.projectWorkActivityIds !== undefined ||
        dto.workNotes !== undefined
      ) {
        await this.applyDayWorkDocumentation(sheet.projectId, existing.id, {
          projectWorkActivityIds: dto.projectWorkActivityIds,
          workNotes: dto.workNotes,
          existingActivityIds: (
            existing as {
              workActivities?: Array<{ projectWorkActivityId: string }>;
            }
          ).workActivities?.map((w) => w.projectWorkActivityId),
          existingNotes: (existing as { workNotes?: string | null }).workNotes,
        });
      }
    } else {
      const created = await this.prisma.weeklyTimesheetDay.create({
        data: { ...data, weeklyTimesheetId: id },
      });
      if (
        dto.projectWorkActivityIds !== undefined ||
        dto.workNotes !== undefined
      ) {
        await this.applyDayWorkDocumentation(sheet.projectId, created.id, {
          projectWorkActivityIds: dto.projectWorkActivityIds,
          workNotes: dto.workNotes,
        });
      }
    }

    await this.recomputeTotals(id);
    return this.findOne(id);
  }

  /**
   * Setzt / validiert projektbezogene Arbeiten an einem Stundenzettel-Tag.
   * Wird erzwungen, sobald Arbeiten-Felder im Request mitgeschickt werden.
   */
  private async applyDayWorkDocumentation(
    projectId: string,
    dayId: string,
    opts: {
      projectWorkActivityIds?: string[];
      workNotes?: string;
      existingActivityIds?: string[];
      existingNotes?: string | null;
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workNotesEnabled: true,
        workActivities: { select: { id: true, active: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }

    const ids =
      opts.projectWorkActivityIds !== undefined
        ? opts.projectWorkActivityIds
        : (opts.existingActivityIds ?? []);
    const notes =
      opts.workNotes !== undefined ? opts.workNotes : opts.existingNotes;

    const allowedIds = new Set(project.workActivities.map((a) => a.id));
    for (const id of ids) {
      if (!allowedIds.has(id)) {
        throw new BadRequestException(
          `Arbeitstätigkeit gehört nicht zu diesem Projekt: ${id}`,
        );
      }
    }

    const activeCount = project.workActivities.filter((a) => a.active).length;
    const validated = validateWorkDocumentation({
      workNotesEnabled: project.workNotesEnabled,
      activeActivityCount: activeCount,
      projectWorkActivityIds: ids,
      workNotes: notes,
    });
    if (!validated.ok) {
      throw new BadRequestException(validated.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.weeklyTimesheetDayWorkActivity.deleteMany({
        where: { dayId },
      });
      if (validated.activityIds.length > 0) {
        await tx.weeklyTimesheetDayWorkActivity.createMany({
          data: validated.activityIds.map((projectWorkActivityId) => ({
            dayId,
            projectWorkActivityId,
          })),
        });
      }
      await tx.weeklyTimesheetDay.update({
        where: { id: dayId },
        data: { workNotes: validated.notes },
      });
    });
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

