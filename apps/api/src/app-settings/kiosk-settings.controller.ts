/**
 * Kiosk-bezogene App-Einstellungen (Debug-Log u. a.).
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { AppSettingsService } from './app-settings.service';

export const KIOSK_DEBUG_ENABLED_KEY = 'kiosk_debug_enabled';

class KioskGeneralSettingsDto {
  @IsBoolean()
  debugLogEnabled!: boolean;
}

@ApiTags('kiosk-settings')
@Controller('kiosk-settings')
export class KioskSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  private async readDebugEnabled(): Promise<boolean> {
    const raw = await this.settings.get(KIOSK_DEBUG_ENABLED_KEY);
    return raw === 'true';
  }

  /** Öffentlich für Kiosk vor PIN – steuert das sichtbare Debug-Log. */
  @Public()
  @SkipThrottle()
  @Get('public')
  @ApiOperation({ summary: 'Öffentliche Kiosk-Einstellungen' })
  async getPublic(): Promise<{ debugLogEnabled: boolean }> {
    return { debugLogEnabled: await this.readDebugEnabled() };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OFFICE')
  @Get('general')
  @ApiOperation({ summary: 'Allgemeine Kiosk-Einstellungen (Office)' })
  async getGeneral(): Promise<{ debugLogEnabled: boolean }> {
    return { debugLogEnabled: await this.readDebugEnabled() };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OFFICE')
  @Put('general')
  @ApiOperation({ summary: 'Allgemeine Kiosk-Einstellungen speichern' })
  async putGeneral(
    @Body() dto: KioskGeneralSettingsDto,
  ): Promise<{ debugLogEnabled: boolean }> {
    await this.settings.set(
      KIOSK_DEBUG_ENABLED_KEY,
      dto.debugLogEnabled ? 'true' : 'false',
    );
    return { debugLogEnabled: dto.debugLogEnabled };
  }
}
