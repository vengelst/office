/**
 * Service für Google Calendar.
 * Kapselt Auth (SA + DWD) und Event-CRUD gegen den primary-Kalender.
 */

import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { AppSettingsService } from '../app-settings/app-settings.service';

export const GOOGLE_CALENDAR_TIMEZONE = 'Europe/Berlin';
export const GOOGLE_CALENDAR_ID = 'primary';

export interface CalendarEventData {
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
}

export interface CalendarConfig {
  enabled: boolean;
  /** Service Account + Impersonation kommen aus den Drive-Einstellungen. */
  credentialsConfigured: boolean;
  impersonateEmail: string;
}

/**
 * Synchronisation von Office-Terminen mit Google Calendar.
 * Nutzt Domain-Wide Delegation und denselben Service Account wie Drive/Contacts.
 * Nur Office → Google (kein Bidirektional), Kalender `primary`, TZ Europe/Berlin.
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
      await calendar.calendars.get({ calendarId: GOOGLE_CALENDAR_ID });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Authentifiziert sich bei der Google Calendar API via JWT und Domain-Wide Delegation.
   * Gibt null zurück wenn die Integration deaktiviert oder nicht konfiguriert ist.
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
   * Erstellt einen Termin im primary-Kalender.
   * @returns Google Event-ID oder null bei Fehler/deaktiviert
   */
  async createEvent(data: CalendarEventData): Promise<string | null> {
    const calendar = await this.authenticate();
    if (!calendar) {
      this.logger.debug('Google Calendar Sync deaktiviert – überspringe.');
      return null;
    }

    try {
      const res = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
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
   * Aktualisiert einen bestehenden Google-Termin.
   */
  async updateEvent(
    googleEventId: string,
    data: CalendarEventData,
  ): Promise<boolean> {
    const calendar = await this.authenticate();
    if (!calendar) return false;

    try {
      await calendar.events.patch({
        calendarId: GOOGLE_CALENDAR_ID,
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
   * Löscht einen Termin aus Google Calendar.
   */
  async deleteEvent(googleEventId: string): Promise<boolean> {
    const calendar = await this.authenticate();
    if (!calendar) return false;

    try {
      await calendar.events.delete({
        calendarId: GOOGLE_CALENDAR_ID,
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

  /**
   * Baut ein Calendar-API Event-Objekt (Europe/Berlin bzw. all-day date).
   */
  private buildEvent(data: CalendarEventData): calendar_v3.Schema$Event {
    const event: calendar_v3.Schema$Event = {
      summary: data.title,
      description: data.description || undefined,
      location: data.location || undefined,
    };

    if (data.allDay) {
      const startDate = this.toDateOnly(data.startAt);
      let endDate = this.toDateOnly(data.endAt);
      // Google Calendar: end.date ist exklusiv
      if (endDate <= startDate) {
        const next = new Date(data.endAt);
        next.setUTCDate(next.getUTCDate() + 1);
        endDate = this.toDateOnly(next);
      } else {
        // inklusives Office-Ende → exklusives Google-Ende (+1 Tag)
        const parts = endDate.split('-').map(Number);
        const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        d.setUTCDate(d.getUTCDate() + 1);
        endDate = d.toISOString().slice(0, 10);
      }
      event.start = { date: startDate };
      event.end = { date: endDate };
    } else {
      event.start = {
        dateTime: data.startAt.toISOString(),
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
      };
      event.end = {
        dateTime: data.endAt.toISOString(),
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
      };
    }

    return event;
  }

  /** YYYY-MM-DD in Europe/Berlin (für Ganztages-Termine). */
  private toDateOnly(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: GOOGLE_CALENDAR_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}
