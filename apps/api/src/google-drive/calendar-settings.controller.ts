/**
 * HTTP-API für Google-Calendar-Einstellungen.
 */

import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CalendarConfig,
  GoogleCalendarService,
} from './google-calendar.service';

class CalendarConfigDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('settings/calendar')
export class CalendarSettingsController {
  constructor(private readonly calendar: GoogleCalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Google Calendar Konfiguration laden' })
  getConfig(): Promise<CalendarConfig> {
    return this.calendar.getConfig();
  }

  @Put()
  @ApiOperation({ summary: 'Google Calendar Konfiguration speichern' })
  async saveConfig(
    @Body() dto: CalendarConfigDto,
  ): Promise<{ saved: true }> {
    await this.calendar.saveConfig(dto);
    return { saved: true };
  }

  @Post('test')
  @ApiOperation({ summary: 'Google Calendar Verbindung testen' })
  testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.calendar.testConnection();
  }
}
