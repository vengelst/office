/**
 * Cron + manuell: zugewiesene Monteure ohne CLOCK_IN bis Check-Zeit → Sammel-Mail.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ProjectStatus,
  TimeEntryType,
  WorkerAvailability,
} from '@prisma/client';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  NO_SHOW_ALERT_ENABLED_KEY,
  NO_SHOW_ALERT_HOUR_KEY,
  NO_SHOW_ALERT_MINUTE_KEY,
  NO_SHOW_ALERT_SENT_KEY,
  noShowSentKey,
  parseNoShowAlertEnabled,
  parseNoShowAlertHour,
  parseNoShowAlertMinute,
  parseNoShowAlertSentState,
  serializeNoShowAlertSentState,
  type NoShowAlertSentState,
} from '../app-settings/no-show-alert';
import { OVERTIME_ALERT_EMAIL_KEY } from '../app-settings/overtime-alert';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { berlinDateKey, berlinDayRange } from './break-calc.util';

/** Verfügbarkeiten, die vom No-Show-Check ausgeschlossen werden. */
const EXCLUDED_AVAILABILITY: WorkerAvailability[] = [
  WorkerAvailability.SICK,
  WorkerAvailability.VACATION,
  WorkerAvailability.UNAVAILABLE,
];

export type NoShowMissingWorker = {
  workerId: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  projects: Array<{
    projectNumber: string;
    title: string;
    roleName: string | null;
  }>;
};

export type NoShowCheckResult = {
  checked: number;
  missing: number;
  sent: number;
  to: string;
  enabled: boolean;
  hour: number;
  minute: number;
  dateKey: string;
  weekend: boolean;
  skippedWeekend: boolean;
  skippedBeforeTime: boolean;
  skippedAlreadyRan: boolean;
  skippedDisabled: boolean;
  skippedNoEmail: boolean;
};

@Injectable()
export class NoShowAlertService {
  private readonly logger = new Logger(NoShowAlertService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    private readonly email: EmailService,
  ) {}

  /** Jede Minute: ab Check-Zeit (Berlin) Mo–Fr No-Shows prüfen. */
  @Cron('* * * * *')
  async cronTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkAndNotify({ source: 'cron' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`No-Show-Alert fehlgeschlagen: ${msg}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Prüft Soll-Liste und sendet ggf. Sammel-Mail.
   *
   * @param opts.force - Dedup und „bereits gelaufen“ ignorieren
   * @param opts.source - cron: Wochenende + Uhrzeit-Gate; manual: immer prüfen
   */
  async checkAndNotify(opts?: {
    force?: boolean;
    source?: 'cron' | 'manual';
    now?: Date;
  }): Promise<NoShowCheckResult> {
    const force = Boolean(opts?.force);
    const source = opts?.source ?? 'manual';
    const now = opts?.now ?? new Date();
    const dateKey = berlinDateKey(now);
    const { hour: berlinHour, minute: berlinMinute, weekday } =
      berlinParts(now);
    const weekend = weekday === 6 || weekday === 7; // Sa=6, So=7 (ISO-like via en-GB)

    const enabled = parseNoShowAlertEnabled(
      await this.settings.get(NO_SHOW_ALERT_ENABLED_KEY),
    );
    const hour = parseNoShowAlertHour(
      await this.settings.get(NO_SHOW_ALERT_HOUR_KEY),
    );
    const minute = parseNoShowAlertMinute(
      await this.settings.get(NO_SHOW_ALERT_MINUTE_KEY),
    );
    const to =
      (await this.settings.get(OVERTIME_ALERT_EMAIL_KEY))?.trim() ?? '';

    const empty = (
      extra: Partial<NoShowCheckResult>,
    ): NoShowCheckResult => ({
      checked: 0,
      missing: 0,
      sent: 0,
      to,
      enabled,
      hour,
      minute,
      dateKey,
      weekend,
      skippedWeekend: false,
      skippedBeforeTime: false,
      skippedAlreadyRan: false,
      skippedDisabled: false,
      skippedNoEmail: false,
      ...extra,
    });

    if (!enabled && source === 'cron') {
      this.logger.debug('No-Show-Alert übersprungen: deaktiviert');
      return empty({ skippedDisabled: true });
    }

    if (source === 'cron' && weekend) {
      this.logger.debug('No-Show-Alert übersprungen: Wochenende');
      return empty({ skippedWeekend: true });
    }

    if (source === 'cron' && !force) {
      const reached =
        berlinHour > hour ||
        (berlinHour === hour && berlinMinute >= minute);
      if (!reached) {
        return empty({ skippedBeforeTime: true });
      }
    }

    const sentState = await this.readSentState();
    if (
      source === 'cron' &&
      !force &&
      sentState.cronRunDate === dateKey
    ) {
      this.logger.debug(
        `No-Show-Alert übersprungen: Cron bereits gelaufen (${dateKey})`,
      );
      return empty({ skippedAlreadyRan: true });
    }

    if (!to || !to.includes('@')) {
      this.logger.debug('No-Show-Alert übersprungen: keine Empfänger-E-Mail');
      // Cron-Tag trotzdem markieren, damit nicht jede Minute geloggt wird
      if (source === 'cron' && enabled) {
        sentState.cronRunDate = dateKey;
        await this.writeSentState(sentState);
      }
      return empty({ skippedNoEmail: true });
    }

    if (!enabled && source === 'manual' && !force) {
      // Manuell darf auch bei disabled prüfen (Admin-Test), aber ohne Mail
      // Spec: Enabled aus → kein Mail. Manual run still returns counters.
    }

    const expected = await this.findExpectedWorkers(now);
    const clockedInIds = await this.findClockedInWorkerIds(
      expected.map((w) => w.workerId),
      dateKey,
    );

    const missingAll = expected.filter((w) => !clockedInIds.has(w.workerId));
    const missingFresh = force
      ? missingAll
      : missingAll.filter(
          (w) => !sentState.sent[noShowSentKey(w.workerId, dateKey)],
        );

    let sentCount = 0;
    // Spec: Enabled aus → kein Mail (auch manuell). Manuell liefert trotzdem Zähler.
    const allowSend = enabled && missingFresh.length > 0;

    if (allowSend) {
      const ok = await this.sendDigestMail({
        to,
        dateKey,
        workers: missingFresh,
      });
      if (ok) {
        sentCount = 1;
        for (const w of missingFresh) {
          sentState.sent[noShowSentKey(w.workerId, dateKey)] = true;
        }
        this.pruneOldSentKeys(sentState, dateKey);
      }
    } else if (!enabled) {
      this.logger.debug(
        'No-Show-Alert: enabled=false → kein Versand (Prüfung trotzdem)',
      );
    }

    if (source === 'cron' || sentCount > 0 || force) {
      if (source === 'cron') {
        sentState.cronRunDate = dateKey;
      }
      await this.writeSentState(sentState);
    }

    this.logger.log(
      `No-Show-Alert-Check (${source}): Soll ${expected.length}, fehlend ${missingAll.length}, neu ${missingFresh.length}, Mail ${sentCount}${weekend ? ' (Wochenende)' : ''}${force ? ' (force)' : ''}`,
    );

    return {
      checked: expected.length,
      missing: missingAll.length,
      sent: sentCount,
      to,
      enabled,
      hour,
      minute,
      dateKey,
      weekend,
      skippedWeekend: false,
      skippedBeforeTime: false,
      skippedAlreadyRan: false,
      skippedDisabled: !enabled && source === 'cron',
      skippedNoEmail: false,
    };
  }

  /** Soll-Liste: aktive Assignments heute + ACTIVE-Projekt + Worker aktiv. */
  async findExpectedWorkers(now: Date): Promise<NoShowMissingWorker[]> {
    const dateKey = berlinDateKey(now);
    const { from, to } = berlinDayRange(dateKey);

    const assignments = await this.prisma.projectAssignment.findMany({
      where: {
        active: true,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
        worker: {
          active: true,
          deletedAt: null,
          availability: { notIn: EXCLUDED_AVAILABILITY },
        },
        project: {
          status: ProjectStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: {
        roleName: true,
        worker: {
          select: {
            id: true,
            workerNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            projectNumber: true,
            title: true,
          },
        },
      },
      orderBy: [
        { worker: { lastName: 'asc' } },
        { worker: { firstName: 'asc' } },
      ],
    });

    const byWorker = new Map<string, NoShowMissingWorker>();
    for (const a of assignments) {
      const existing = byWorker.get(a.worker.id);
      const project = {
        projectNumber: a.project.projectNumber,
        title: a.project.title,
        roleName: a.roleName,
      };
      if (existing) {
        existing.projects.push(project);
      } else {
        byWorker.set(a.worker.id, {
          workerId: a.worker.id,
          workerNumber: a.worker.workerNumber,
          firstName: a.worker.firstName,
          lastName: a.worker.lastName,
          projects: [project],
        });
      }
    }
    return Array.from(byWorker.values());
  }

  private async findClockedInWorkerIds(
    workerIds: string[],
    dateKey: string,
  ): Promise<Set<string>> {
    if (workerIds.length === 0) return new Set();
    const { from, to } = berlinDayRange(dateKey);
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        workerId: { in: workerIds },
        entryType: TimeEntryType.CLOCK_IN,
        occurredAtClient: { gte: from, lte: to },
      },
      select: { workerId: true },
      distinct: ['workerId'],
    });
    return new Set(entries.map((e) => e.workerId));
  }

  private async sendDigestMail(params: {
    to: string;
    dateKey: string;
    workers: NoShowMissingWorker[];
  }): Promise<boolean> {
    const dateLabel = formatBerlinDateDe(params.dateKey);
    const subject = `Keine Einstempelung – ${dateLabel}`;
    const rows = params.workers
      .map((w) => {
        const name = `${w.firstName} ${w.lastName}`.trim();
        const projects = w.projects
          .map((p) => {
            const role = p.roleName ? ` (${escapeHtml(p.roleName)})` : '';
            return `${escapeHtml(p.projectNumber)} – ${escapeHtml(p.title)}${role}`;
          })
          .join('<br/>');
        return `<tr>
  <td style="padding:8px;border:1px solid #ddd">${escapeHtml(name)}</td>
  <td style="padding:8px;border:1px solid #ddd">${escapeHtml(w.workerNumber)}</td>
  <td style="padding:8px;border:1px solid #ddd">${projects}</td>
</tr>`;
      })
      .join('\n');

    const html = `<div style="font-family:sans-serif;padding:20px;color:#222">
  <h2 style="margin:0 0 12px">Keine Einstempelung</h2>
  <p>Folgende zugewiesene Monteure haben am <strong>${escapeHtml(dateLabel)}</strong> noch nicht eingestempelt:</p>
  <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Monteur</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Worker-Nr.</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Projekt(e) / Zuweisung</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p style="color:#666;font-size:12px">Automatische Meldung aus Office · No-Show-Reminder · Mo–Fr</p>
</div>`;

    const result = await this.email.send(params.to, subject, html);
    if (result.success) {
      this.logger.log(
        `No-Show-Alert gesendet: ${params.workers.length} Worker → ${params.to}`,
      );
      return true;
    }
    this.logger.warn(
      `No-Show-Alert nicht gesendet: ${result.error ?? 'unbekannt'}`,
    );
    return false;
  }

  private async readSentState(): Promise<NoShowAlertSentState> {
    return parseNoShowAlertSentState(
      await this.settings.get(NO_SHOW_ALERT_SENT_KEY),
    );
  }

  private async writeSentState(state: NoShowAlertSentState): Promise<void> {
    await this.settings.set(
      NO_SHOW_ALERT_SENT_KEY,
      serializeNoShowAlertSentState(state),
    );
  }

  /** Behält nur Keys vom heutigen und gestrigen Tag. */
  private pruneOldSentKeys(
    state: NoShowAlertSentState,
    todayKey: string,
  ): void {
    const keep = new Set([todayKey, shiftBerlinDateKey(todayKey, -1)]);
    for (const key of Object.keys(state.sent)) {
      const datePart = key.includes('|') ? key.split('|').pop()! : '';
      if (!keep.has(datePart)) {
        delete state.sent[key];
      }
    }
  }
}

/** Stunde/Minute/Wochentag in Europe/Berlin (weekday: Mo=1 … So=7). */
export function berlinParts(d: Date): {
  hour: number;
  minute: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return { hour, minute, weekday: map[wd] ?? 1 };
}

/** True wenn Sa/So in Europe/Berlin. */
export function isBerlinWeekend(d: Date): boolean {
  const { weekday } = berlinParts(d);
  return weekday === 6 || weekday === 7;
}

function formatBerlinDateDe(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const iso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return iso.toLocaleDateString('de-DE', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function shiftBerlinDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
