/**
 * Manueller Trigger für No-Show-Reminder (auch am Wochenende).
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  NoShowAlertService,
  type NoShowCheckResult,
} from './no-show-alert.service';

class NoShowAlertRunDto {
  /** Dedup und „bereits gelaufen“ für diesen Lauf ignorieren. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@ApiTags('kiosk-settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('kiosk-settings/no-show-alert')
export class NoShowAlertController {
  constructor(private readonly noShowAlert: NoShowAlertService) {}

  @Post('run')
  @ApiOperation({
    summary:
      'No-Show-Reminder jetzt prüfen (auch am Wochenende; optional Force-Resend)',
  })
  async runNow(@Body() dto: NoShowAlertRunDto): Promise<NoShowCheckResult> {
    return this.noShowAlert.checkAndNotify({
      source: 'manual',
      force: Boolean(dto?.force),
    });
  }
}
