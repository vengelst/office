/**
 * Kiosk-/GPS-/PIN-/Arbeitszeit-Alarm-/Auto-Clock-Out-/No-Show-Einstellungen.
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { AppSettingsService } from './app-settings.service';
import {
  DEFAULT_PIN_LENGTH,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  parsePinLength,
  PIN_LENGTH_KEY,
} from './pin-length';
import {
  AUTO_CLOCK_OUT_ENABLED_KEY,
  AUTO_CLOCK_OUT_HOURS_KEY,
  DEFAULT_AUTO_CLOCK_OUT_HOURS,
  MAX_AUTO_CLOCK_OUT_HOURS,
  MIN_AUTO_CLOCK_OUT_HOURS,
  parseAutoClockOutEnabled,
  parseAutoClockOutHours,
} from './auto-clock-out';
import {
  DEFAULT_DOCUMENT_UPLOAD_MAX_MB,
  DOCUMENT_UPLOAD_MAX_MB_KEY,
  MAX_DOCUMENT_UPLOAD_MAX_MB,
  MIN_DOCUMENT_UPLOAD_MAX_MB,
  parseDocumentUploadMaxMb,
} from './document-upload-limit';
import {
  DEFAULT_NO_SHOW_ALERT_HOUR,
  DEFAULT_NO_SHOW_ALERT_MINUTE,
  MAX_NO_SHOW_ALERT_HOUR,
  MAX_NO_SHOW_ALERT_MINUTE,
  MIN_NO_SHOW_ALERT_HOUR,
  MIN_NO_SHOW_ALERT_MINUTE,
  NO_SHOW_ALERT_ENABLED_KEY,
  NO_SHOW_ALERT_HOUR_KEY,
  NO_SHOW_ALERT_MINUTE_KEY,
  NO_SHOW_ALERT_SENT_KEY,
  parseNoShowAlertEnabled,
  parseNoShowAlertHour,
  parseNoShowAlertMinute,
} from './no-show-alert';
import {
  DEFAULT_OVERTIME_ALERT_HOURS,
  DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  DEFAULT_OVERTIME_ALERT_REMINDERS,
  MAX_OVERTIME_ALERT_HOURS,
  MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  MAX_OVERTIME_ALERT_REMINDERS,
  MIN_OVERTIME_ALERT_HOURS,
  MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
  MIN_OVERTIME_ALERT_REMINDERS,
  OVERTIME_ALERT_EMAIL_KEY,
  OVERTIME_ALERT_HOURS_KEY,
  OVERTIME_ALERT_REMINDER_INTERVAL_KEY,
  OVERTIME_ALERT_REMINDERS_KEY,
  OVERTIME_ALERT_SENT_KEY,
  parseOvertimeAlertHours,
  parseOvertimeAlertReminderIntervalMinutes,
  parseOvertimeAlertReminders,
} from './overtime-alert';

export const KIOSK_DEBUG_ENABLED_KEY = 'kiosk_debug_enabled';
export const GPS_INTERVAL_MINUTES_KEY = 'gps_interval_minutes';
export const DEFAULT_GPS_INTERVAL_MINUTES = 20;

class KioskGeneralSettingsDto {
  @IsBoolean()
  debugLogEnabled!: boolean;

  /** Abstand zwischen periodischen GPS-Punkten in Minuten (1–240). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  gpsIntervalMinutes!: number;

  /** Länge der Stempel-/Kiosk-PIN (4–8 Ziffern). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PIN_LENGTH)
  @Max(MAX_PIN_LENGTH)
  pinLength!: number;

  /**
   * Empfänger für Alarm bei durchgehend überschrittener Arbeitszeit.
   * Leer = Alarm deaktiviert.
   */
  @IsString()
  @MaxLength(200)
  @ValidateIf((_, v) => typeof v === 'string' && v.trim() !== '')
  @IsEmail({}, { message: 'Ungültige E-Mail-Adresse für Arbeitszeit-Alarm' })
  overtimeAlertEmail!: string;

  /** Schwelle in Stunden (1–24), durchgehend seit CLOCK_IN. */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_OVERTIME_ALERT_HOURS)
  @Max(MAX_OVERTIME_ALERT_HOURS)
  overtimeAlertHours!: number;

  /** Anzahl Alarme pro offener Stempelung inkl. erster Meldung (1–10). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_OVERTIME_ALERT_REMINDERS)
  @Max(MAX_OVERTIME_ALERT_REMINDERS)
  overtimeAlertReminders!: number;

  /** Minuten zwischen zwei Alarmen derselben Stempelung (5–240). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES)
  @Max(MAX_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES)
  overtimeAlertReminderIntervalMinutes!: number;

  /** Auto-Clock-Out nach Maximaldauer aktiv. */
  @IsBoolean()
  autoClockOutEnabled!: boolean;

  /** Schwelle in Stunden (1–24) für systemseitiges Ausstempeln. */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_AUTO_CLOCK_OUT_HOURS)
  @Max(MAX_AUTO_CLOCK_OUT_HOURS)
  autoClockOutHours!: number;

  /** No-Show-Reminder aktiv (Mo–Fr ab Check-Zeit). */
  @IsBoolean()
  noShowAlertEnabled!: boolean;

  /** Check-Stunde Europe/Berlin (0–23). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_NO_SHOW_ALERT_HOUR)
  @Max(MAX_NO_SHOW_ALERT_HOUR)
  noShowAlertHour!: number;

  /** Check-Minute Europe/Berlin (0–59). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_NO_SHOW_ALERT_MINUTE)
  @Max(MAX_NO_SHOW_ALERT_MINUTE)
  noShowAlertMinute!: number;

  /** Max. Upload-Größe für Pläne/Dokumente in MB (5–64, nginx 64m). */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DOCUMENT_UPLOAD_MAX_MB)
  @Max(MAX_DOCUMENT_UPLOAD_MAX_MB)
  documentUploadMaxMb!: number;
}

export type KioskGeneralSettings = {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
  pinLength: number;
  overtimeAlertEmail: string;
  overtimeAlertHours: number;
  overtimeAlertReminders: number;
  overtimeAlertReminderIntervalMinutes: number;
  autoClockOutEnabled: boolean;
  autoClockOutHours: number;
  noShowAlertEnabled: boolean;
  noShowAlertHour: number;
  noShowAlertMinute: number;
  documentUploadMaxMb: number;
};

@ApiTags('kiosk-settings')
@Controller('kiosk-settings')
export class KioskSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  private async readAll(): Promise<KioskGeneralSettings> {
    const map = await this.settings.getMany([
      KIOSK_DEBUG_ENABLED_KEY,
      GPS_INTERVAL_MINUTES_KEY,
      PIN_LENGTH_KEY,
      OVERTIME_ALERT_EMAIL_KEY,
      OVERTIME_ALERT_HOURS_KEY,
      OVERTIME_ALERT_REMINDERS_KEY,
      OVERTIME_ALERT_REMINDER_INTERVAL_KEY,
      AUTO_CLOCK_OUT_ENABLED_KEY,
      AUTO_CLOCK_OUT_HOURS_KEY,
      NO_SHOW_ALERT_ENABLED_KEY,
      NO_SHOW_ALERT_HOUR_KEY,
      NO_SHOW_ALERT_MINUTE_KEY,
      DOCUMENT_UPLOAD_MAX_MB_KEY,
    ]);
    const rawInterval = map[GPS_INTERVAL_MINUTES_KEY];
    const parsed = rawInterval ? Number.parseInt(rawInterval, 10) : NaN;
    return {
      debugLogEnabled: map[KIOSK_DEBUG_ENABLED_KEY] === 'true',
      gpsIntervalMinutes:
        Number.isFinite(parsed) && parsed >= 1 && parsed <= 240
          ? parsed
          : DEFAULT_GPS_INTERVAL_MINUTES,
      pinLength: parsePinLength(map[PIN_LENGTH_KEY]),
      overtimeAlertEmail: (map[OVERTIME_ALERT_EMAIL_KEY] ?? '').trim(),
      overtimeAlertHours: parseOvertimeAlertHours(
        map[OVERTIME_ALERT_HOURS_KEY],
      ),
      overtimeAlertReminders: parseOvertimeAlertReminders(
        map[OVERTIME_ALERT_REMINDERS_KEY],
      ),
      overtimeAlertReminderIntervalMinutes:
        parseOvertimeAlertReminderIntervalMinutes(
          map[OVERTIME_ALERT_REMINDER_INTERVAL_KEY],
        ),
      autoClockOutEnabled: parseAutoClockOutEnabled(
        map[AUTO_CLOCK_OUT_ENABLED_KEY],
      ),
      autoClockOutHours: parseAutoClockOutHours(
        map[AUTO_CLOCK_OUT_HOURS_KEY],
      ),
      noShowAlertEnabled: parseNoShowAlertEnabled(
        map[NO_SHOW_ALERT_ENABLED_KEY],
      ),
      noShowAlertHour: parseNoShowAlertHour(map[NO_SHOW_ALERT_HOUR_KEY]),
      noShowAlertMinute: parseNoShowAlertMinute(map[NO_SHOW_ALERT_MINUTE_KEY]),
      documentUploadMaxMb: parseDocumentUploadMaxMb(
        map[DOCUMENT_UPLOAD_MAX_MB_KEY],
      ),
    };
  }

  /** Öffentlich für Kiosk / Monteur-App – ohne Alarm-Felder. */
  @Public()
  @SkipThrottle()
  @Get('public')
  @ApiOperation({ summary: 'Öffentliche Kiosk-/GPS-/PIN-Einstellungen' })
  async getPublic(): Promise<
    Pick<
      KioskGeneralSettings,
      'debugLogEnabled' | 'gpsIntervalMinutes' | 'pinLength'
    >
  > {
    const all = await this.readAll();
    return {
      debugLogEnabled: all.debugLogEnabled,
      gpsIntervalMinutes: all.gpsIntervalMinutes,
      pinLength: all.pinLength,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OFFICE')
  @Get('general')
  @ApiOperation({ summary: 'Allgemeine Einstellungen (Office)' })
  async getGeneral(): Promise<KioskGeneralSettings> {
    return this.readAll();
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OFFICE')
  @Put('general')
  @ApiOperation({ summary: 'Allgemeine Einstellungen speichern' })
  async putGeneral(
    @Body() dto: KioskGeneralSettingsDto,
  ): Promise<KioskGeneralSettings> {
    const pinLength = parsePinLength(String(dto.pinLength));
    const overtimeAlertEmail = (dto.overtimeAlertEmail ?? '').trim();
    const overtimeAlertHours = parseOvertimeAlertHours(
      String(dto.overtimeAlertHours),
    );
    const overtimeAlertReminders = parseOvertimeAlertReminders(
      String(dto.overtimeAlertReminders),
    );
    const overtimeAlertReminderIntervalMinutes =
      parseOvertimeAlertReminderIntervalMinutes(
        String(dto.overtimeAlertReminderIntervalMinutes),
      );
    const autoClockOutEnabled = Boolean(dto.autoClockOutEnabled);
    const autoClockOutHours = parseAutoClockOutHours(
      String(dto.autoClockOutHours),
    );
    const noShowAlertEnabled = Boolean(dto.noShowAlertEnabled);
    const noShowAlertHour = parseNoShowAlertHour(String(dto.noShowAlertHour));
    const noShowAlertMinute = parseNoShowAlertMinute(
      String(dto.noShowAlertMinute),
    );
    const documentUploadMaxMb = parseDocumentUploadMaxMb(
      String(dto.documentUploadMaxMb),
    );

    const previous = await this.readAll();
    const overtimeChanged =
      previous.overtimeAlertEmail !== overtimeAlertEmail ||
      previous.overtimeAlertHours !== overtimeAlertHours ||
      previous.overtimeAlertReminders !== overtimeAlertReminders ||
      previous.overtimeAlertReminderIntervalMinutes !==
        overtimeAlertReminderIntervalMinutes;
    const noShowChanged =
      previous.noShowAlertEnabled !== noShowAlertEnabled ||
      previous.noShowAlertHour !== noShowAlertHour ||
      previous.noShowAlertMinute !== noShowAlertMinute ||
      previous.overtimeAlertEmail !== overtimeAlertEmail;

    const updates: Record<string, string> = {
      [KIOSK_DEBUG_ENABLED_KEY]: dto.debugLogEnabled ? 'true' : 'false',
      [GPS_INTERVAL_MINUTES_KEY]: String(dto.gpsIntervalMinutes),
      [PIN_LENGTH_KEY]: String(pinLength || DEFAULT_PIN_LENGTH),
      [OVERTIME_ALERT_EMAIL_KEY]: overtimeAlertEmail,
      [OVERTIME_ALERT_HOURS_KEY]: String(
        overtimeAlertHours || DEFAULT_OVERTIME_ALERT_HOURS,
      ),
      [OVERTIME_ALERT_REMINDERS_KEY]: String(
        overtimeAlertReminders || DEFAULT_OVERTIME_ALERT_REMINDERS,
      ),
      [OVERTIME_ALERT_REMINDER_INTERVAL_KEY]: String(
        overtimeAlertReminderIntervalMinutes ||
          DEFAULT_OVERTIME_ALERT_REMINDER_INTERVAL_MINUTES,
      ),
      [AUTO_CLOCK_OUT_ENABLED_KEY]: autoClockOutEnabled ? 'true' : 'false',
      [AUTO_CLOCK_OUT_HOURS_KEY]: String(
        autoClockOutHours || DEFAULT_AUTO_CLOCK_OUT_HOURS,
      ),
      [NO_SHOW_ALERT_ENABLED_KEY]: noShowAlertEnabled ? 'true' : 'false',
      [NO_SHOW_ALERT_HOUR_KEY]: String(
        Number.isFinite(noShowAlertHour)
          ? noShowAlertHour
          : DEFAULT_NO_SHOW_ALERT_HOUR,
      ),
      [NO_SHOW_ALERT_MINUTE_KEY]: String(
        Number.isFinite(noShowAlertMinute)
          ? noShowAlertMinute
          : DEFAULT_NO_SHOW_ALERT_MINUTE,
      ),
      [DOCUMENT_UPLOAD_MAX_MB_KEY]: String(
        documentUploadMaxMb || DEFAULT_DOCUMENT_UPLOAD_MAX_MB,
      ),
    };
    // Bei geänderter Schwelle/Adresse erneut alarmieren dürfen (Dedup zurücksetzen).
    if (overtimeChanged) {
      updates[OVERTIME_ALERT_SENT_KEY] = '{}';
    }
    if (noShowChanged) {
      updates[NO_SHOW_ALERT_SENT_KEY] = serializeResetSent();
    }

    await this.settings.setMany(updates);
    return {
      debugLogEnabled: dto.debugLogEnabled,
      gpsIntervalMinutes: dto.gpsIntervalMinutes,
      pinLength,
      overtimeAlertEmail,
      overtimeAlertHours,
      overtimeAlertReminders,
      overtimeAlertReminderIntervalMinutes,
      autoClockOutEnabled,
      autoClockOutHours,
      noShowAlertEnabled,
      noShowAlertHour,
      noShowAlertMinute,
      documentUploadMaxMb,
    };
  }
}

function serializeResetSent(): string {
  return JSON.stringify({ cronRunDate: null, sent: {} });
}
