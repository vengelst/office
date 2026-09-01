/**
 * Cron: durchgehend eingestempelte Monteure über Schwellwert → E-Mail-Alarm.
 * Optional mehrere Erinnerungen im konfigurierten Minuten-Abstand.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimeEntryType } from '@prisma/client';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  OVERTIME_ALERT_EMAIL_KEY,
  OVERTIME_ALERT_HOURS_KEY,
  OVERTIME_ALERT_REMINDER_INTERVAL_KEY,
  OVERTIME_ALERT_REMINDERS_KEY,
  OVERTIME_ALERT_SENT_KEY,
  parseOvertimeAlertHours,
  parseOvertimeAlertReminderIntervalMinutes,
  parseOvertimeAlertReminders,
  parseOvertimeSentEntry,
  type OvertimeSentState,
} from '../app-settings/overtime-alert';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const CLOCK_TYPES: TimeEntryType[] = [
  TimeEntryType.CLOCK_IN,
  TimeEntryType.CLOCK_OUT,
];

type SentMap = Record<string, OvertimeSentState>;

@Injectable()
export class OvertimeAlertService {
  private readonly logger = new Logger(OvertimeAlertService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    private readonly email: EmailService,
  ) {}

  /** Alle 5 Minuten: offene Schichten über Schwellwert prüfen. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cronTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkAndNotify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Overtime-Alert fehlgeschlagen: ${msg}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Sendet eine Test-Mail an die konfigurierte (oder übergebene) Adresse,
   * ohne Stempeldaten – nur SMTP + Empfänger prüfen.
   */
  async sendTestMail(
    toOverride?: string,
  ): Promise<{ success: boolean; to: string; error?: string }> {
    const configured =
      (await this.settings.get(OVERTIME_ALERT_EMAIL_KEY))?.trim() ?? '';
    const to = (toOverride?.trim() || configured).trim();
    if (!to || !to.includes('@')) {
      return {
        success: false,
        to: '',
        error: 'Keine Empfänger-E-Mail hinterlegt.',
      };
    }
    const alertHours = parseOvertimeAlertHours(
      await this.settings.get(OVERTIME_ALERT_HOURS_KEY),
    );
    const reminders = parseOvertimeAlertReminders(
      await this.settings.get(OVERTIME_ALERT_REMINDERS_KEY),
    );
    const intervalMinutes = parseOvertimeAlertReminderIntervalMinutes(
      await this.settings.get(OVERTIME_ALERT_REMINDER_INTERVAL_KEY),
    );
    const subject = 'Arbeitszeit-Alarm – Test';
    const html = `<div style="font-family:sans-serif;padding:20px;color:#222">
  <h2 style="margin:0 0 12px">Arbeitszeit-Alarm – Test</h2>
  <p>Diese Test-Mail bestätigt, dass der Arbeitszeit-Alarm E-Mails zustellen kann.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Empfänger</td><td>${escapeHtml(to)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Schwelle</td><td><strong>${alertHours} Stunden</strong> durchgehend</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Erinnerungen</td><td>${reminders}× im Abstand von ${intervalMinutes} Min.</td></tr>
  </table>
  <p style="color:#666;font-size:12px">Test aus Office · Einstellungen → Allgemein</p>
</div>`;
    const result = await this.email.send(to, subject, html);
    if (result.success) {
      this.logger.log(`Overtime-Alert-Test gesendet → ${to}`);
      return { success: true, to };
    }
    this.logger.warn(
      `Overtime-Alert-Test fehlgeschlagen: ${result.error ?? 'unbekannt'}`,
    );
    return {
      success: false,
      to,
      error: result.error ?? 'Versand fehlgeschlagen',
    };
  }

  /**
   * Prüft offene Stempelungen und sendet Alarme inkl. konfigurierter Erinnerungen.
   *
   * @param forceResend - Intervall und Max-Anzahl für diesen Lauf ignorieren
   */
  async checkAndNotify(forceResend = false): Promise<{
    checked: number;
    sent: number;
    to: string;
    alertHours: number;
    reminders: number;
    intervalMinutes: number;
  }> {
    const to =
      (await this.settings.get(OVERTIME_ALERT_EMAIL_KEY))?.trim() ?? '';
    if (!to || !to.includes('@')) {
      this.logger.debug('Overtime-Alert übersprungen: keine Empfänger-E-Mail');
      return {
        checked: 0,
        sent: 0,
        to: '',
        alertHours: 0,
        reminders: 0,
        intervalMinutes: 0,
      };
    }

    const alertHours = parseOvertimeAlertHours(
      await this.settings.get(OVERTIME_ALERT_HOURS_KEY),
    );
    const maxReminders = parseOvertimeAlertReminders(
      await this.settings.get(OVERTIME_ALERT_REMINDERS_KEY),
    );
    const intervalMinutes = parseOvertimeAlertReminderIntervalMinutes(
      await this.settings.get(OVERTIME_ALERT_REMINDER_INTERVAL_KEY),
    );
    const thresholdMinutes = alertHours * 60;
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
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

    const sentMap = await this.readSentMap();
    const openIds = new Set(open.map((e) => e.id));
    let mapDirty = false;
    for (const id of Object.keys(sentMap)) {
      if (!openIds.has(id)) {
        delete sentMap[id];
        mapDirty = true;
      }
    }

    const now = new Date();
    let sentCount = 0;
    for (const e of open) {
      const durationMinutes = Math.max(
        0,
        Math.round((now.getTime() - e.occurredAtClient.getTime()) / 60000),
      );
      if (durationMinutes < thresholdMinutes) continue;

      const prev = sentMap[e.id];
      const alreadySent = prev?.count ?? 0;
      if (!forceResend) {
        if (alreadySent >= maxReminders) continue;
        if (prev) {
          const lastMs = Date.parse(prev.lastSentAt);
          const elapsedMin = Number.isFinite(lastMs)
            ? (now.getTime() - lastMs) / 60000
            : Infinity;
          if (elapsedMin < intervalMinutes) continue;
        }
      }

      const nextCount = alreadySent + 1;
      const workerName = `${e.worker.firstName} ${e.worker.lastName}`.trim();
      const projectLabel = e.project
        ? `${e.project.projectNumber} – ${e.project.title}`
        : 'Kein Projekt';
      const customer = e.project?.customer?.companyName ?? '–';
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationLabel = `${hours} Std. ${mins} Min.`;
      const sinceLabel = e.occurredAtClient.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
      });
      const reminderLabel =
        maxReminders > 1 ? ` · Erinnerung ${nextCount}/${maxReminders}` : '';

      const subject = `Arbeitszeit überschritten: ${workerName}${reminderLabel}`;
      const html = `<div style="font-family:sans-serif;padding:20px;color:#222">
  <h2 style="margin:0 0 12px">Arbeitszeit überschritten</h2>
  <p>Ein Monteur ist durchgehend länger als ${alertHours} Stunden eingestempelt.${
    maxReminders > 1
      ? ` Dies ist Meldung <strong>${nextCount}</strong> von <strong>${maxReminders}</strong>.`
      : ''
  }</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Monteur</td><td><strong>${escapeHtml(workerName)}</strong> (${escapeHtml(e.worker.workerNumber)})</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Projekt</td><td>${escapeHtml(projectLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Kunde</td><td>${escapeHtml(customer)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Eingestempelt seit</td><td>${escapeHtml(sinceLabel)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Dauer</td><td><strong>${escapeHtml(durationLabel)}</strong></td></tr>
  </table>
  <p style="color:#666;font-size:12px">Automatische Meldung aus Office · Schwelle ${alertHours} Std.${
    maxReminders > 1
      ? ` · bis zu ${maxReminders}× alle ${intervalMinutes} Min.`
      : ''
  }</p>
</div>`;

      const result = await this.email.send(to, subject, html);
      if (result.success) {
        sentMap[e.id] = {
          count: nextCount,
          lastSentAt: now.toISOString(),
        };
        mapDirty = true;
        sentCount += 1;
        this.logger.log(
          `Overtime-Alert gesendet (${nextCount}/${maxReminders}): ${workerName} (${durationLabel}) → ${to}`,
        );
      } else {
        this.logger.warn(
          `Overtime-Alert nicht gesendet (${workerName}): ${result.error ?? 'unbekannt'}`,
        );
      }
    }

    if (mapDirty) {
      await this.settings.set(
        OVERTIME_ALERT_SENT_KEY,
        JSON.stringify(sentMap),
      );
    }

    this.logger.log(
      `Overtime-Alert-Check: ${open.length} offen, Schwelle ${alertHours}h, Erinnerungen ${maxReminders}×/${intervalMinutes}min, gesendet ${sentCount}${forceResend ? ' (force)' : ''}`,
    );
    return {
      checked: open.length,
      sent: sentCount,
      to,
      alertHours,
      reminders: maxReminders,
      intervalMinutes,
    };
  }

  private async readSentMap(): Promise<SentMap> {
    const raw = await this.settings.get(OVERTIME_ALERT_SENT_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const out: SentMap = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const entry = parseOvertimeSentEntry(v);
        if (entry) out[k] = entry;
      }
      return out;
    } catch {
      return {};
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
