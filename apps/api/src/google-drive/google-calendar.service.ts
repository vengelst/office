/**
 * Service für Google Calendar.
 * Sync Office → Google (primary Kalender des Impersonation-Users).
 */

import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { AppSettingsService } from '../app-settings/app-settings.service';

const TIME_ZONE = 'Europe/Berlin';

export interface CalendarEventData {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
}

export interface CalendarConfig {
  enabled: boolean;
  /** Service Account + Impersonation kommen aus den Drive-Einstellungen. */
  credentialsConfigured: boolean;
  impersonateEmail: string;
}

/**
 * Service für die Synchronisation von Terminen mit Google Calendar.
 * Nutzt die Calendar API mit Domain-Wide Delegation um Events im Google-Konto
 * des impersonierten Benutzers zu verwalten.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly settings: AppSettingsService) {}

  /**
   * Liest Calendar-Toggle und ob Drive-Credentials vorhanden sind.
   */
  async getConfig(): Promise<CalendarConfig> {
    const [enabled, json, email] = await Promise.all([
      this.settings.get('google_calendar_enabled'),
      this.settings.get('google_drive_service_account_json'),
      this.settings.get('google_drive_impersonate_email'),
    ]);
    return {
      enabled: enabled === 'true',
      credentialsConfigured: Boolean(json?.trim() && email?.trim()),
      impersonateEmail: email ?? '',
    };
  }

  /**
   * Speichert nur den Calendar-Aktivierungsschalter.
   * Credentials bleiben unter Speicher & Cloud (Google Drive).
   */
  async saveConfig(config: Pick<CalendarConfig, 'enabled'>): Promise<void> {
    await this.settings.set('google_calendar_enabled', String(config.enabled));
  }

  /**
   * Prüft Calendar-API-Zugang (calendar-Scope + DWD).
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const calendar = await this.authenticate({ requireEnabled: false });
      if (!calendar) {
        return {
          success: false,
          error:
            'Service Account oder Impersonation-E-Mail fehlt (unter Speicher & Cloud setzen).',
        };
      }
      await calendar.calendarList.get({ calendarId: 'primary' });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Authentifiziert sich bei der Google Calendar API via JWT und Domain-Wide Delegation.
   */
  private async authenticate(opts?: {
    requireEnabled?: boolean;
  }): Promise<calendar_v3.Calendar | null> {
    const requireEnabled = opts?.requireEnabled !== false;
    const [enabled, json, email] = await Promise.all([
      this.settings.get('google_calendar_enabled'),
      this.settings.get('google_drive_service_account_json'),
      this.settings.get('google_drive_impersonate_email'),
    ]);

    if (requireEnabled && enabled !== 'true') return null;
    if (!json?.trim() || !email?.trim()) return null;

    const credentials = JSON.parse(json);
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: email,
    });

    return google.calendar({ version: 'v3', auth: jwtClient });
  }

  /**
   * Erstellt ein Event im primary Kalender.
   * @returns Google Event-ID oder null
   */
  async createEvent(data: CalendarEventData): Promise<string | null> {
    const calendar = await this.authenticate();
    if (!calendar) {
      this.logger.debug('Google Calendar Sync deaktiviert – überspringe.');
      return null;
    }

    try {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: this.buildEvent(data),
      });
      const eventId = res.data.id ?? null;
      this.logger.log(`Google Termin erstellt: ${eventId}`);
      return eventId;
    } catch (err) {
      this.logger.warn(
        `Google Termin konnte nicht erstellt werden: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Aktualisiert ein bestehendes Google-Event.
   */
  async updateEvent(
    googleEventId: string,
    data: CalendarEventData,
  ): Promise<boolean> {
    const calendar = await this.authenticate();
    if (!calendar) return false;

    try {
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: this.buildEvent(data),
      });
      this.logger.log(`Google Termin aktualisiert: ${googleEventId}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Google Termin konnte nicht aktualisiert werden: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Löscht ein Event aus Google Calendar.
   */
  async deleteEvent(googleEventId: string): Promise<boolean> {
    const calendar = await this.authenticate();
    if (!calendar) return false;

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });
      this.logger.log(`Google Termin gelöscht: ${googleEventId}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Google Termin konnte nicht gelöscht werden: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private buildEvent(data: CalendarEventData): calendar_v3.Schema$Event {
    const description = data.description?.trim()
      ? `${data.description.trim()}\n\n— Office (vivahome)`
      : '— Office (vivahome)';

    if (data.allDay) {
      const startDate = this.toDateOnly(data.startsAt);
      const endExclusive = this.toAllDayExclusiveEnd(data.startsAt, data.endsAt);
      return {
        summary: data.title,
        description,
        start: { date: startDate },
        end: { date: endExclusive },
      };
    }

    return {
      summary: data.title,
      description,
      start: {
        dateTime: data.startsAt.toISOString(),
        timeZone: TIME_ZONE,
      },
      end: {
        dateTime: data.endsAt.toISOString(),
        timeZone: TIME_ZONE,
      },
    };
  }

  /** YYYY-MM-DD in Europe/Berlin. */
  private toDateOnly(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /**
   * Google all-day end ist exklusiv (Tag nach dem letzten Tag).
   */
  private toAllDayExclusiveEnd(startsAt: Date, endsAt: Date): string {
    const start = this.toDateOnly(startsAt);
    const end = this.toDateOnly(endsAt);
    if (end > start) {
      const endDate = new Date(`${end}T12:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      return endDate.toISOString().slice(0, 10);
    }
    const startDate = new Date(`${start}T12:00:00Z`);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    return startDate.toISOString().slice(0, 10);
  }
}
