/**
 * Kiosk-/GPS-bezogene App-Einstellungen.
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { AppSettingsService } from './app-settings.service';

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
}

export type KioskGeneralSettings = {
  debugLogEnabled: boolean;
  gpsIntervalMinutes: number;
};

@ApiTags('kiosk-settings')
@Controller('kiosk-settings')
export class KioskSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  private async readAll(): Promise<KioskGeneralSettings> {
    const map = await this.settings.getMany([
      KIOSK_DEBUG_ENABLED_KEY,
      GPS_INTERVAL_MINUTES_KEY,
    ]);
    const rawInterval = map[GPS_INTERVAL_MINUTES_KEY];
    const parsed = rawInterval ? Number.parseInt(rawInterval, 10) : NaN;
    return {
      debugLogEnabled: map[KIOSK_DEBUG_ENABLED_KEY] === 'true',
      gpsIntervalMinutes:
        Number.isFinite(parsed) && parsed >= 1 && parsed <= 240
          ? parsed
          : DEFAULT_GPS_INTERVAL_MINUTES,
    };
  }

  /** Öffentlich für Kiosk / Monteur-App – Debug-Log + GPS-Intervall. */
  @Public()
  @SkipThrottle()
  @Get('public')
  @ApiOperation({ summary: 'Öffentliche Kiosk-/GPS-Einstellungen' })
  async getPublic(): Promise<KioskGeneralSettings> {
    return this.readAll();
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
    await this.settings.setMany({
      [KIOSK_DEBUG_ENABLED_KEY]: dto.debugLogEnabled ? 'true' : 'false',
      [GPS_INTERVAL_MINUTES_KEY]: String(dto.gpsIntervalMinutes),
    });
    return {
      debugLogEnabled: dto.debugLogEnabled,
      gpsIntervalMinutes: dto.gpsIntervalMinutes,
    };
  }
}
