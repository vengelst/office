/**
 * Cron: offene Schichten nach konfigurierter Maximaldauer systemseitig beenden.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimeEntryType } from '@prisma/client';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  AUTO_CLOCK_OUT_ENABLED_KEY,
  AUTO_CLOCK_OUT_HOURS_KEY,
  SYSTEM_AUTO_CLOCK_OUT_DEVICE,
  autoClockOutComment,
  parseAutoClockOutEnabled,
  parseAutoClockOutHours,
} from '../app-settings/auto-clock-out';
import { OVERTIME_ALERT_EMAIL_KEY } from '../app-settings/overtime-alert';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeEntriesService } from './time-entries.service';

const CLOCK_TYPES: TimeEntryType[] = [
  TimeEntryType.CLOCK_IN,
  TimeEntryType.CLOCK_OUT,
];

/** Lookback für offene Schichten (vergessene Stempelungen über Tage). */
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class AutoClockOutService {
  private readonly logger = new Logger(AutoClockOutService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    private readonly email: EmailService,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  /** Alle 5 Minuten: offene Schichten über Auto-Out-Schwelle schließen. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cronTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkAndClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Auto-Clock-Out fehlgeschlagen: ${msg}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Prüft offene Stempelungen und schließt bei Überschreitung systemseitig.
   */
  async checkAndClose(): Promise<{
    checked: number;
    closed: number;
    mailed: number;
    enabled: boolean;
    hours: number;
    to: string;
  }> {
    const enabled = parseAutoClockOutEnabled(
      await this.settings.get(AUTO_CLOCK_OUT_ENABLED_KEY),
    );
    const hours = parseAutoClockOutHours(
      await this.settings.get(AUTO_CLOCK_OUT_HOURS_KEY),
    );
    const to =
      (await this.settings.get(OVERTIME_ALERT_EMAIL_KEY))?.trim() ?? '';

    if (!enabled) {
      this.logger.debug('Auto-Clock-Out übersprungen: deaktiviert');
      return { checked: 0, closed: 0, mailed: 0, enabled: false, hours, to };
    }

    const thresholdMs = hours * 60 * 60 * 1000;
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_MS);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        entryType: { in: CLOCK_TYPES },
        occurredAtClient: { gte: since },
        worker: { active: true, deletedAt: null },
      },
      orderBy: { occurredAtClient: 'desc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        workDocumentedAt: true,
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
            id: true,
            projectNumber: true,
            title: true,
            customer: { select: { companyName: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const open: typeof entries = [];
    for (const e of entries) {
      if (seen.has(e.worker.id)) continue;
      seen.add(e.worker.id);
      if (e.entryType === TimeEntryType.CLOCK_IN) {
        open.push(e);
      }
    }

    let closed = 0;
    let mailed = 0;
    const comment = autoClockOutComment(hours);

    for (const e of open) {
      const clockInAt = e.occurredAtClient;
      if (clockInAt.getTime() > now.getTime()) {
        this.logger.warn(
          `Auto-Clock-Out übersprungen: CLOCK_IN in der Zukunft (${e.worker.id})`,
        );
        continue;
      }

      const elapsedMs = now.getTime() - clockInAt.getTime();
      if (elapsedMs < thresholdMs) continue;

      const occurredAtClient = new Date(clockInAt.getTime() + thresholdMs);

      try {
        const result = await this.timeEntries.systemClockOut({
          workerId: e.worker.id,
          occurredAtClient,
          comment,
          sourceDevice: SYSTEM_AUTO_CLOCK_OUT_DEVICE,
        });
        closed += 1;

        const workerName = `${e.worker.firstName} ${e.worker.lastName}`.trim();
        this.logger.log(
          `Auto-Clock-Out: ${workerName} (${e.worker.workerNumber}) nach ${hours}h → Entry ${result.clockOutTimeEntryId}`,
        );

        if (to && to.includes('@')) {
          const sent = await this.sendNotifyMail({
            to,
            workerName,
            workerNumber: e.worker.workerNumber,
            projectLabel: e.project
              ? `${e.project.projectNumber} – ${e.project.title}`
              : 'Kein Projekt',
            customer: e.project?.customer?.companyName ?? '–',
            clockInAt,
            clockOutAt: occurredAtClient,
            hours,
          });
          if (sent) mailed += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Auto-Clock-Out fehlgeschlagen für Worker ${e.worker.id}: ${msg}`,
        );
      }
    }

    this.logger.log(
      `Auto-Clock-Out-Check: ${open.length} offen, Schwelle ${hours}h, geschlossen ${closed}, Mails ${mailed}`,
    );
    return {
      checked: open.length,
      closed,
      mailed,
      enabled: true,
      hours,
      to,
    };
  }

  private async sendNotifyMail(params: {
    to: string;
    workerName: string;
    workerNumber: string;
    projectLabel: string;
    customer: string;
    clockInAt: Date;
    clockOutAt: Date;
    hours: number;
  }): Promise<boolean> {
    const inLabel = params.clockInAt.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
    });
    const outLabel = params.clockOutAt.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
    });
    const subject = `Auto-Ausstempelung: ${params.workerName}`;
    const html = `<div style="font-family:sans-serif;padding:20px;color:#222">
  <h2 style="margin:0 0 12px">Automatische Ausstempelung</h2>
  <p>Ein Monteur wurde nach <strong>${params.hours} Stunden</strong> durchgehend eingestempelt systemseitig ausgestempelt.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Monteur</td><td><strong>${escapeHtml(params.workerName)}</strong> (${escapeHtml(params.workerNumber)})</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Projekt</td><td>${escapeHtml(params.projectLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Kunde</td><td>${escapeHtml(params.customer)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Einstempeln</td><td>${escapeHtml(inLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Ausstempeln</td><td>${escapeHtml(outLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Dauer</td><td><strong>${params.hours} Stunden</strong></td></tr>
  </table>
  <p style="color:#666;font-size:12px">Automatische Meldung aus Office · Auto-Clock-Out · Arbeitsdokumentation ggf. noch ausstehend</p>
</div>`;

    const result = await this.email.send(params.to, subject, html);
    if (result.success) {
      this.logger.log(
        `Auto-Clock-Out-Mail gesendet: ${params.workerName} → ${params.to}`,
      );
      return true;
    }
    this.logger.warn(
      `Auto-Clock-Out-Mail fehlgeschlagen (${params.workerName}): ${result.error ?? 'unbekannt'}`,
    );
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
