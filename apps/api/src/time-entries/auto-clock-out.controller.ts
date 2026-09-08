/**
 * Manueller Trigger für Auto-Clock-Out (Admin-Test).
 */

import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AutoClockOutService } from './auto-clock-out.service';

@ApiTags('kiosk-settings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.SUPERADMIN, RoleCode.OFFICE)
@Controller('kiosk-settings/auto-clock-out')
export class AutoClockOutController {
  constructor(private readonly autoClockOut: AutoClockOutService) {}

  @Post('run')
  @ApiOperation({
    summary:
      'Auto-Clock-Out jetzt prüfen und offene Schichten über der Schwelle schließen',
  })
  async runNow(): Promise<{
    checked: number;
    closed: number;
    mailed: number;
    enabled: boolean;
    hours: number;
    to: string;
  }> {
    return this.autoClockOut.checkAndClose();
  }
}
